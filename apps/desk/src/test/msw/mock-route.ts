import {
  type AnySchemaRoute,
  type AnyStreamRoute,
  errorOutputSchema,
} from "@caseai-connect/desk-contracts"
import { delay, HttpResponse, http, type PathParams, type RequestHandlerOptions } from "msw"
import { z } from "zod"

type MockedRoute = AnySchemaRoute | AnyStreamRoute

/** The params of the route, as its schema outputs them. */
type MockParams<TRoute extends MockedRoute> = z.output<TRoute["schemas"]["params"]>

/** The query of the route, decoded by its schema: a page is a number, a JSON parameter an object. */
type MockQuery<TRoute extends MockedRoute> = z.output<TRoute["schemas"]["query"]>

/** The `payload` of the body, as the API's validation pipe outputs it, or `undefined` without one. */
type MockPayload<TRoute extends AnySchemaRoute> =
  z.output<TRoute["schemas"]["body"]> extends { payload: infer TPayload } ? TPayload : undefined

/** The `data` the route answers, before its response schema parses it. */
type MockData<TRoute extends AnySchemaRoute> = z.input<TRoute["schemas"]["response"]>["data"]

type MaybePromise<TValue> = TValue | Promise<TValue>

type MockRouteRequest<TRoute extends AnySchemaRoute> = {
  params: MockParams<TRoute>
  query: MockQuery<TRoute>
  payload: MockPayload<TRoute>
  request: Request
}

/**
 * What a mocked route answers: its `data`, which goes through the response schema, or a
 * `Response` of its own, such as `apiError(404)`, or a body that breaks the contract on purpose.
 */
export type MockRouteResolver<TRoute extends AnySchemaRoute> = (
  request: MockRouteRequest<TRoute>,
) => MaybePromise<MockData<TRoute> | Response>

const STATUS_TEXTS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  500: "Internal Server Error",
  503: "Service Unavailable",
}

/** An error answer of the API, with the body Nest sends: `{ statusCode, message, error }`. */
export function apiError(status: number, message?: string): Response {
  const error = STATUS_TEXTS[status] ?? "Error"
  return HttpResponse.json(
    errorOutputSchema.parse({ statusCode: status, message: message ?? error, error }),
    { status },
  )
}

/** The URL pattern of a route for MSW, which reads `:name` segments as the contracts write them. */
const pathOf = (route: MockedRoute) => `*/api${route.path}`

/** The params MSW matched, parsed by the route's schema; the `*` wildcard's own param is left out. */
function parseParams<TSchema extends z.ZodObject>(
  schema: TSchema,
  params: PathParams,
): z.ZodSafeParseResult<z.output<TSchema>> {
  const declared = Object.keys(schema.shape)
  return schema.safeParse(
    Object.fromEntries(Object.entries(params).filter(([name]) => declared.includes(name))),
  )
}

/** The query string, decoded by the route's schema: its codecs turn the strings into values. */
function parseQuery<TSchema extends z.ZodObject>(
  schema: TSchema,
  request: Request,
): z.ZodSafeParseResult<z.output<TSchema>> {
  return schema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
}

/** A request the contract refuses, as the API's validation pipe answers it: a 400. */
const invalidRequest = (error: z.ZodError) => apiError(400, z.prettifyError(error))

/**
 * An MSW handler for a route of the contracts: its method and path come from the route, its
 * params, query and body are decoded by the route's schemas (a 400 when they refuse them, as the
 * API's validation pipe does), and the `data` the resolver returns is parsed by the response
 * schema, so a mock cannot drift from the contract. A POST answers 201, as Nest does by default.
 */
export function mockRoute<TRoute extends AnySchemaRoute>(
  route: TRoute,
  // The route alone decides the types: the resolver's answer is checked against them.
  resolver: NoInfer<MockRouteResolver<TRoute>>,
  options?: RequestHandlerOptions,
) {
  const routeName = `${route.method.toUpperCase()} ${route.path}`
  const hasBody = "payload" in route.schemas.body.shape
  return http[route.method](
    pathOf(route),
    async ({ params, request }) => {
      const parsedParams = parseParams<TRoute["schemas"]["params"]>(route.schemas.params, params)
      if (!parsedParams.success) return invalidRequest(parsedParams.error)
      const parsedQuery = parseQuery<TRoute["schemas"]["query"]>(route.schemas.query, request)
      if (!parsedQuery.success) return invalidRequest(parsedQuery.error)
      const body = route.schemas.body.safeParse(hasBody ? await request.clone().json() : {})
      if (!body.success) return invalidRequest(body.error)

      const answer = await resolver({
        params: parsedParams.data,
        query: parsedQuery.data,
        // Safe: the body schema outputs `{ payload }` when the route reads a body, and `{}`
        // otherwise, which MockPayload<TRoute> names in each case: the payload, or undefined.
        payload: ("payload" in body.data ? body.data.payload : undefined) as MockPayload<TRoute>,
        request,
      })
      if (answer instanceof Response) return answer
      const response = route.schemas.response.safeParse({ data: answer })
      if (!response.success) {
        throw new Error(
          `The mock of ${routeName} broke its contract:\n${z.prettifyError(response.error)}`,
        )
      }
      return HttpResponse.json(response.data, { status: route.method === "post" ? 201 : 200 })
    },
    options,
  )
}

/** A frame of a mocked stream: an event of the route, or what the handler throws. */
export type MockStreamFrame<TRoute extends AnyStreamRoute> =
  | { event: z.input<TRoute["schemas"]["event"]> }
  /** Nest writes what a stream's handler throws as an `error` frame whose data is the bare message. */
  | { thrownError: string }

export type MockStreamResolver<TRoute extends AnyStreamRoute> = (request: {
  params: MockParams<TRoute>
  query: MockQuery<TRoute>
  request: Request
}) => MaybePromise<MockStreamFrame<TRoute>[] | Response>

/** One frame as Nest writes it, with an `id:` line. */
function serializeFrame<TRoute extends AnyStreamRoute>(
  route: TRoute,
  frame: MockStreamFrame<TRoute>,
): string {
  if ("thrownError" in frame) return `event: error\ndata: ${frame.thrownError}\n\n`
  return `id: 1\ndata: ${JSON.stringify(route.schemas.event.parse(frame.event))}\n\n`
}

/** The frames as a stream, with a pause before each one, as a real agent takes. */
function streamOf(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      for (const frame of frames) {
        await delay()
        controller.enqueue(encoder.encode(frame))
      }
      controller.close()
    },
  })
}

/**
 * An MSW handler for a stream route of the contracts: its params and query are decoded by the
 * route's schemas, and each event the resolver returns is parsed by the event schema, then sent
 * as a server-sent event. A list that ends without an `end` event is a stream that closes early.
 */
export function mockStreamRoute<TRoute extends AnyStreamRoute>(
  route: TRoute,
  // The route alone decides the types: the resolver's frames are checked against them.
  resolver: NoInfer<MockStreamResolver<TRoute>>,
  options?: RequestHandlerOptions,
) {
  return http.get(
    pathOf(route),
    async ({ params, request }) => {
      const parsedParams = parseParams<TRoute["schemas"]["params"]>(route.schemas.params, params)
      if (!parsedParams.success) return invalidRequest(parsedParams.error)
      const parsedQuery = parseQuery<TRoute["schemas"]["query"]>(route.schemas.query, request)
      if (!parsedQuery.success) return invalidRequest(parsedQuery.error)
      const answer = await resolver({
        params: parsedParams.data,
        query: parsedQuery.data,
        request,
      })
      if (answer instanceof Response) return answer
      const frames = answer.map((frame) => serializeFrame(route, frame))
      return new HttpResponse(streamOf(frames), {
        headers: { "Content-Type": "text/event-stream" },
      })
    },
    options,
  )
}
