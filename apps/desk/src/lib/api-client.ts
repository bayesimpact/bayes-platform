import {
  type AnySchemaRoute,
  type AnyStreamRoute,
  type ErrorOutputDto,
  errorOutputSchema,
  signInRefusalOf,
} from "@caseai-connect/desk-contracts"
import { z } from "zod"
import {
  AuthenticationRequiredError,
  claimAutomaticSignIn,
  endSession,
  getAccessToken,
  SignInLoopError,
  SignInRefusedError,
  signIn,
} from "@/lib/auth/session"

/** An error response of the API, with its body when it matches the error schema. */
export class ApiError extends Error {
  readonly status: number
  readonly body: ErrorOutputDto | null

  constructor(status: number, body: ErrorOutputDto | null) {
    super(body ? String(body.message) : `The API answered ${status}`)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

/**
 * A response the route's schema rejects: this tab runs a build older or newer than the API's. The
 * error page offers to reload.
 */
export class ContractMismatchError extends Error {
  constructor(routeName: string) {
    super(`The response of ${routeName} does not match its contract`)
    this.name = "ContractMismatchError"
  }
}

/**
 * The params or the query, which the caller passes only when the route declares them, as the
 * schema outputs them: `z.encode` turns them into the strings of the URL.
 */
type Part<TName extends string, TSchema extends z.ZodType> = Record<
  never,
  never
> extends z.output<TSchema>
  ? { [Key in TName]?: z.output<TSchema> }
  : { [Key in TName]: z.output<TSchema> }

/** The body, which the caller passes only when the route reads one, as its schema takes it. */
type BodyPart<TRoute extends AnySchemaRoute> =
  z.input<TRoute["schemas"]["body"]> extends { payload: infer TPayload }
    ? { body: TPayload }
    : { body?: never }

/** The `data` of the route's response, as its schema outputs it. */
type ResponseData<TRoute extends AnySchemaRoute> = z.output<TRoute["schemas"]["response"]>["data"]

type ApiRequestOptions<TRoute extends AnySchemaRoute> = Part<
  "params",
  TRoute["schemas"]["params"]
> &
  Part<"query", TRoute["schemas"]["query"]> &
  BodyPart<TRoute> & { signal?: AbortSignal }

type ApiRequestArgs<TRoute extends AnySchemaRoute> =
  Record<never, never> extends ApiRequestOptions<TRoute>
    ? [options?: ApiRequestOptions<TRoute>]
    : [options: ApiRequestOptions<TRoute>]

/**
 * Calls a Desk endpoint on this origin's `/api`, with the bearer token, and returns its `data`,
 * parsed with the route's response schema. The only place the Desk calls `fetch` for the API.
 */
export async function apiRequest<TRoute extends AnySchemaRoute>(
  route: TRoute,
  ...[options]: ApiRequestArgs<TRoute>
): Promise<ResponseData<TRoute>> {
  const response = await apiFetch(route, options ?? {})
  const routeName = `${route.method.toUpperCase()} ${route.path}`
  let body: unknown
  try {
    body = await response.json()
  } catch {
    // A body that is not JSON, such as a proxy's page, breaks the contract as much as a wrong one.
    console.error(`${routeName} answered with a body that is not JSON`)
    throw new ContractMismatchError(routeName)
  }
  const result = route.schemas.response.safeParse(body)
  if (!result.success) {
    console.error(`${routeName} broke its contract:`, z.prettifyError(result.error))
    throw new ContractMismatchError(routeName)
  }
  return result.data.data
}

type ApiStreamOptions<TRoute extends AnyStreamRoute> = Part<"params", TRoute["schemas"]["params"]> &
  Part<"query", TRoute["schemas"]["query"]> & { signal?: AbortSignal }

/**
 * Opens a Desk stream on this origin's `/api`, with the bearer token, and returns the response
 * whose body `lib/stream.ts` reads. An error answer, sent before the stream starts, throws.
 */
export function apiStreamResponse<TRoute extends AnyStreamRoute>(
  route: TRoute,
  options: ApiStreamOptions<TRoute>,
): Promise<Response> {
  return apiFetch(route, { ...options, accept: "text/event-stream" })
}

/**
 * Sends a request built from the route's schemas, with the bearer token: a 401 refreshes the
 * token once, then starts a new sign-in, and an error answer throws an `ApiError`.
 */
async function apiFetch(
  route: AnySchemaRoute | AnyStreamRoute,
  options: RequestOptions,
): Promise<Response> {
  const request = buildRequest(route, options)
  let response = await send(request, { forceRefresh: false })
  // The token may have been revoked before it expired: refresh it once.
  if (response.status === 401) response = await send(request, { forceRefresh: true })
  if (response.status === 401) {
    // A refusal of the API would come back after any new sign-in: it is explained instead.
    const refusal = signInRefusalOf((await readErrorBody(response))?.message)
    if (refusal) throw new SignInRefusedError(refusal)
    await startNewSignIn()
  }

  if (!response.ok) throw new ApiError(response.status, await readErrorBody(response))
  return response
}

type RequestOptions = {
  params?: Record<string, unknown>
  query?: Record<string, unknown>
  body?: unknown
  signal?: AbortSignal
  accept?: string
}

type PreparedRequest = { url: URL; init: RequestInit }

/**
 * The request the route's schemas describe. The params keep only the keys the route declares, so
 * a caller may pass a wider object, such as a conversation's params to a route of its agent. A
 * value the schemas refuse is a bug of the Desk, never retried: `InvalidRequestError`.
 */
function buildRequest(
  route: AnySchemaRoute | AnyStreamRoute,
  options: RequestOptions,
): PreparedRequest {
  const declared = Object.keys(route.schemas.params.shape)
  const ownParams = Object.fromEntries(
    Object.entries(options.params ?? {}).filter(([name]) => declared.includes(name)),
  )
  const params = encodeOrThrow(route, () => z.encode(route.schemas.params, ownParams))
  const query = encodeOrThrow(route, () => z.encode(route.schemas.query, options.query ?? {}))
  const url = new URL(`/api${route.getPath(toStrings(params))}`, window.location.origin)
  for (const [name, value] of Object.entries(toStrings(query))) url.searchParams.set(name, value)

  const hasBody = options.body !== undefined
  // The body goes through its schema too: it applies the contract's trims and limits.
  const body = hasBody
    ? encodeOrThrow(route, () => route.schemas.body.parse({ payload: options.body }))
    : undefined
  return {
    url,
    init: {
      method: route.method.toUpperCase(),
      headers: {
        Accept: options.accept ?? "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  }
}

/** A request whose params, query or body the route's schemas refuse: a bug of the Desk. */
export class InvalidRequestError extends Error {
  constructor(routeName: string, cause: unknown) {
    super(`The request of ${routeName} does not match its contract`, { cause })
    this.name = "InvalidRequestError"
  }
}

function encodeOrThrow<TValue>(
  route: AnySchemaRoute | AnyStreamRoute,
  encode: () => TValue,
): TValue {
  try {
    return encode()
  } catch (error) {
    throw new InvalidRequestError(`${route.method.toUpperCase()} ${route.path}`, error)
  }
}

/** The encoded params or query as strings, without the values left out. */
function toStrings(values: unknown): Record<string, string> {
  if (typeof values !== "object" || values === null) return {}
  return Object.fromEntries(
    Object.entries(values).flatMap(([name, value]) =>
      value === undefined || value === null ? [] : [[name, String(value)]],
    ),
  )
}

async function send(request: PreparedRequest, { forceRefresh }: { forceRefresh: boolean }) {
  let accessToken: string
  try {
    accessToken = await getAccessToken({ forceRefresh })
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return await startNewSignIn()
    throw error
  }
  return fetch(request.url, {
    ...request.init,
    headers: { ...request.init.headers, Authorization: `Bearer ${accessToken}` },
  })
}

/**
 * The session is gone: forget it and sign in again, back to this page. A session that ends again
 * right after a new sign-in stops there, which a page then explains, rather than loop.
 */
async function startNewSignIn(): Promise<never> {
  if (!claimAutomaticSignIn()) throw new SignInLoopError()
  await endSession()
  const { pathname, search, hash } = window.location
  await signIn({ returnTo: `${pathname}${search}${hash}` })
  throw new AuthenticationRequiredError("The session ended: a new sign-in started.")
}

async function readErrorBody(response: Response): Promise<ErrorOutputDto | null> {
  try {
    const result = errorOutputSchema.safeParse(await response.json())
    return result.success ? result.data : null
  } catch {
    // Not JSON, such as a proxy's error page.
    return null
  }
}
