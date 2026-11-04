import { z } from "zod"

export type SchemaRouteMethod = "get" | "post" | "put" | "patch" | "delete"

/** The params, the query and the body of a route are objects. */
type ObjectSchema = z.ZodObject

/** The schema of a part the route does not read: it accepts an object with no key, and nothing else. */
const emptySchema = z.strictObject({})
type EmptySchema = typeof emptySchema

/** The names of the `:name` segments of a path, such as `"organizationId" | "projectId"`. */
export type PathParamNames<TPath extends string> =
  TPath extends `${string}:${infer Name}/${infer Rest}`
    ? Name | PathParamNames<Rest>
    : TPath extends `${string}:${infer Name}`
      ? Name
      : never

/** Refuses, at compile time, a params schema whose keys are not exactly the `:name` segments of the path. */
type ParamsMatchPath<TPath extends string, TParams extends ObjectSchema> = [
  Exclude<keyof TParams["shape"], PathParamNames<TPath>>,
  Exclude<PathParamNames<TPath>, keyof TParams["shape"]>,
] extends [never, never]
  ? unknown
  : { params: `The params schema must declare exactly the :name segments of "${TPath}"` }

/** What travels as the request body: `{ payload }` when the route reads a body, an empty object otherwise. */
type BodyEnvelope<TBody extends ObjectSchema | undefined> = TBody extends ObjectSchema
  ? z.ZodObject<{ payload: TBody }, z.core.$strict>
  : EmptySchema

type SchemaRouteDefinition<
  TMethod extends SchemaRouteMethod,
  TPath extends string,
  TParams extends ObjectSchema,
  TQuery extends ObjectSchema,
  TBody extends ObjectSchema | undefined,
  TResponse extends z.ZodType,
> = {
  method: TMethod
  path: TPath
  params?: TParams
  query?: TQuery
  body?: TBody
  response: TResponse
}

export type SchemaRoute<
  TMethod extends SchemaRouteMethod,
  TParams extends ObjectSchema,
  TQuery extends ObjectSchema,
  TBody extends ObjectSchema | undefined,
  TResponse extends z.ZodType,
> = {
  path: string
  getPath: (params?: Record<string, string>) => string
  method: TMethod
  schemas: {
    params: TParams
    query: TQuery
    body: BodyEnvelope<TBody>
    response: z.ZodObject<{ data: TResponse }>
  }
}

/** Any route declared with `defineSchemaRoute`. */
export type AnySchemaRoute = SchemaRoute<
  SchemaRouteMethod,
  ObjectSchema,
  ObjectSchema,
  ObjectSchema | undefined,
  z.ZodType
>

/**
 * Declares a route of the API with the Zod schemas of what the Desk sends and reads. The Desk's
 * client builds the request from them and parses the response at runtime, so a response that
 * drifts from the contract fails loudly. The API does not use them yet.
 */
export function defineSchemaRoute<
  TMethod extends SchemaRouteMethod,
  TPath extends string,
  TResponse extends z.ZodType,
  TParams extends ObjectSchema = EmptySchema,
  TQuery extends ObjectSchema = EmptySchema,
  TBody extends ObjectSchema | undefined = undefined,
>(
  definition: SchemaRouteDefinition<TMethod, TPath, TParams, TQuery, TBody, TResponse> &
    ParamsMatchPath<TPath, TParams>,
): SchemaRoute<TMethod, TParams, TQuery, TBody, TResponse> {
  const path = definition.path.startsWith("/") ? definition.path : `/${definition.path}`
  const body = definition.body ? z.strictObject({ payload: definition.body }) : emptySchema
  return {
    path,
    getPath: (params) => (params ? interpolatePath(path, params) : path),
    method: definition.method,
    schemas: {
      // Safe: TParams and TQuery default to EmptySchema, the schema used when the part is absent.
      params: (definition.params ?? emptySchema) as TParams,
      query: (definition.query ?? emptySchema) as TQuery,
      // Safe: `body` is the envelope of `definition.body` when present and `emptySchema` otherwise,
      // which is what BodyEnvelope<TBody> names in each case.
      body: body as BodyEnvelope<TBody>,
      response: z.object({ data: definition.response }),
    },
  }
}

export type StreamRouteMethod = "get" | "post"

/** A route that answers with server-sent events, each checked against the `event` schema. */
export type StreamRoute<
  TMethod extends StreamRouteMethod,
  TParams extends ObjectSchema,
  TQuery extends ObjectSchema,
  TBody extends ObjectSchema | undefined,
  TEvent extends z.ZodType,
> = {
  path: string
  getPath: (params?: Record<string, string>) => string
  method: TMethod
  schemas: { params: TParams; query: TQuery; body: BodyEnvelope<TBody>; event: TEvent }
}

/** Any route declared with `defineStreamRoute`. */
export type AnyStreamRoute = StreamRoute<
  StreamRouteMethod,
  ObjectSchema,
  ObjectSchema,
  ObjectSchema | undefined,
  z.ZodType
>

/**
 * Declares a route of the API that streams server-sent events, with the schemas of its params,
 * its query, its body and each of its events. What a person writes goes in the body of a POST,
 * never in the query: a URL has a length limit at proxies, and access logs keep it.
 */
export function defineStreamRoute<
  TMethod extends StreamRouteMethod,
  TPath extends string,
  TEvent extends z.ZodType,
  TParams extends ObjectSchema = EmptySchema,
  TQuery extends ObjectSchema = EmptySchema,
  TBody extends ObjectSchema | undefined = undefined,
>(
  definition: {
    method: TMethod
    path: TPath
    params?: TParams
    query?: TQuery
    body?: TBody
    event: TEvent
  } & ParamsMatchPath<TPath, TParams>,
): StreamRoute<TMethod, TParams, TQuery, TBody, TEvent> {
  const path = definition.path.startsWith("/") ? definition.path : `/${definition.path}`
  const body = definition.body ? z.strictObject({ payload: definition.body }) : emptySchema
  return {
    path,
    getPath: (params) => (params ? interpolatePath(path, params) : path),
    method: definition.method,
    schemas: {
      // Safe: TParams and TQuery default to EmptySchema, the schema used when the part is absent.
      params: (definition.params ?? emptySchema) as TParams,
      query: (definition.query ?? emptySchema) as TQuery,
      // Safe: `body` is the envelope of `definition.body` when present and `emptySchema` otherwise,
      // which is what BodyEnvelope<TBody> names in each case.
      body: body as BodyEnvelope<TBody>,
      event: definition.event,
    },
  }
}

/** Replaces each `:name` segment with its encoded value, and keeps the segments it has no value for. */
function interpolatePath(path: string, params: Record<string, string>): string {
  return path.replace(/:(\w+)/g, (segment, name: string) => {
    const value = params[name]
    return value ? encodeURIComponent(value) : segment
  })
}
