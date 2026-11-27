import {
  type AnySchemaRoute,
  type AnyStreamRoute,
  type ErrorOutputDto,
  errorOutputSchema,
} from "@caseai-connect/schema-route"
import {
  AuthenticationRequiredError,
  SignInLoopError,
  SignInRefusedError,
  signInRefusalOf,
} from "@caseai-connect/sign-in"
import { z } from "zod"

/**
 * What the client needs of the app's session: the app's `lib/auth/session.ts`, which wraps
 * `@caseai-connect/sign-in` with the app's namespace and its mock mode.
 */
export type ApiClientSession = {
  getAccessToken: (options: { forceRefresh: boolean }) => Promise<string>
  /** The app's guard against a loop of automatic sign-ins: false when one started a moment ago. */
  claimAutomaticSignIn: () => boolean
  endSession: () => Promise<void>
  signIn: (params: { returnTo: string }) => Promise<void>
}

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

/** A request whose params, query or body the route's schemas refuse: a bug of the app. */
export class InvalidRequestError extends Error {
  constructor(routeName: string, cause: unknown) {
    super(`The request of ${routeName} does not match its contract`, { cause })
    this.name = "InvalidRequestError"
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
type BodyPart<TRoute extends AnySchemaRoute | AnyStreamRoute> =
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

type ApiStreamOptions<TRoute extends AnyStreamRoute> = Part<"params", TRoute["schemas"]["params"]> &
  Part<"query", TRoute["schemas"]["query"]> &
  BodyPart<TRoute> & { signal?: AbortSignal }

/**
 * The client of an app's endpoints, on the app's session. The app creates it once, in its
 * `lib/api-client.ts`, the only place the app calls `fetch` for the API.
 */
export function createApiClient(session: ApiClientSession) {
  /**
   * Calls an endpoint on this origin's `/api`, with the bearer token, and returns its `data`,
   * parsed with the route's response schema.
   */
  async function apiRequest<TRoute extends AnySchemaRoute>(
    route: TRoute,
    ...[options]: ApiRequestArgs<TRoute>
  ): Promise<ResponseData<TRoute>> {
    const response = await apiFetch(session, route, options ?? {})
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

  /**
   * Opens a stream on this origin's `/api`, with the bearer token, and returns the response whose
   * body `readServerSentEvents` reads. An error answer, sent before the stream starts, throws.
   */
  function apiStreamResponse<TRoute extends AnyStreamRoute>(
    route: TRoute,
    options: ApiStreamOptions<TRoute>,
  ): Promise<Response> {
    return apiFetch(session, route, { ...options, accept: "text/event-stream" })
  }

  return { apiRequest, apiStreamResponse }
}

/** The client `createApiClient` returns, for what takes an app's client as an option. */
export type ApiClient = ReturnType<typeof createApiClient>

/**
 * Sends a request built from the route's schemas, with the bearer token: a 401 refreshes the
 * token once, then starts a new sign-in, and an error answer throws an `ApiError`.
 */
async function apiFetch(
  session: ApiClientSession,
  route: AnySchemaRoute | AnyStreamRoute,
  options: RequestOptions,
): Promise<Response> {
  const request = buildRequest(route, options)
  let response = await send(session, request, { forceRefresh: false })
  // The token may have been revoked before it expired: refresh it once.
  if (response.status === 401) response = await send(session, request, { forceRefresh: true })
  if (response.status === 401) {
    // A refusal of the API would come back after any new sign-in: it is explained instead.
    const refusal = signInRefusalOf((await readErrorBody(response))?.message)
    if (refusal) throw new SignInRefusedError(refusal)
    await startNewSignIn(session)
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
 * value the schemas refuse is a bug of the app, never retried: `InvalidRequestError`.
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

async function send(
  session: ApiClientSession,
  request: PreparedRequest,
  { forceRefresh }: { forceRefresh: boolean },
) {
  let accessToken: string
  try {
    accessToken = await session.getAccessToken({ forceRefresh })
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return await startNewSignIn(session)
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
async function startNewSignIn(session: ApiClientSession): Promise<never> {
  if (!session.claimAutomaticSignIn()) throw new SignInLoopError()
  await session.endSession()
  const { pathname, search, hash } = window.location
  await session.signIn({ returnTo: `${pathname}${search}${hash}` })
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
