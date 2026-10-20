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
  /** Phantom type of the request body, as on the routes of `defineRoute`: never read at runtime. */
  request: TBody extends ObjectSchema ? { payload: z.input<TBody> } : undefined
  /** Phantom type of the response, as on the routes of `defineRoute`: never read at runtime. */
  response: { data: z.output<TResponse> }
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
 * Declares a route with the Zod schemas of everything it receives and returns. Both the API and the
 * Desk parse each part with them at runtime. A part the route does not declare must arrive empty.
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
    // Phantom types: these two values exist for typing only, and nothing reads them at runtime.
    request: undefined as SchemaRoute<TMethod, TParams, TQuery, TBody, TResponse>["request"],
    response: undefined as unknown as { data: z.output<TResponse> },
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

/** Replaces each `:name` segment with its encoded value, and keeps the segments it has no value for. */
function interpolatePath(path: string, params: Record<string, string>): string {
  return path.replace(/:(\w+)/g, (segment, name: string) => {
    const value = params[name]
    return value ? encodeURIComponent(value) : segment
  })
}
