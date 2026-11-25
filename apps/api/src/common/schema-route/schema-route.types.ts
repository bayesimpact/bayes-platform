import type { AnySchemaRoute, AnyStreamRoute } from "@caseai-connect/schema-route"
import type { z } from "zod"
import type { ContextResource } from "@/common/context/require-context.decorator"
import type { TrackActivityOptions } from "@/domains/activities/track-activity.decorator"
import type { PermissionResourceType } from "@/domains/rbac/permission.types"
import type { CatalogPermission } from "@/domains/rbac/rbac.constants"

/** The routes of every contracts package, declared with `defineSchemaRoute` and `defineStreamRoute`. */
export type {
  AnySchemaRoute,
  AnyStreamRoute,
  SchemaRouteMethod,
} from "@caseai-connect/schema-route"

/** The metadata key under which `@SchemaRoute` stores the route of a handler. */
export const SCHEMA_ROUTE_METADATA_KEY = "schema_route"

/** The request key under which the input guard stores the parsed input. */
export const SCHEMA_ROUTE_INPUT_REQUEST_KEY = "schemaRouteInput"

/** A permission key with the resource it is checked on, or `"signed-in"` for a route open to any signed-in person. */
export type SchemaRoutePermission =
  | { key: CatalogPermission; on: PermissionResourceType }
  | "signed-in"

export type SchemaRouteOptions = {
  permission: SchemaRoutePermission
  context?: ContextResource[]
  activity?: TrackActivityOptions
  /** Defaults to Nest's: 201 for a POST, 200 otherwise. A stream answers 200. */
  status?: number
}

/** The `payload` of a parsed body envelope, and `undefined` when the route reads no body. */
type PayloadOf<TBody> = TBody extends { payload: infer TPayload } ? TPayload : undefined

/** What a handler reads through `@RouteInput()`: the params, query and payload, parsed by the route's schemas. */
export type SchemaRouteInput<TRoute extends AnySchemaRoute | AnyStreamRoute> = {
  params: z.output<TRoute["schemas"]["params"]>
  query: z.output<TRoute["schemas"]["query"]>
  payload: PayloadOf<z.output<TRoute["schemas"]["body"]>>
}

/** What a handler returns: the input of the route's response schema, which the interceptor parses. */
export type SchemaRouteResponse<TRoute extends AnySchemaRoute> = z.input<
  TRoute["schemas"]["response"]
>

/** A request after the input guard ran. The route is not known there, so the payload is not typed. */
export type RequestWithSchemaRouteInput = {
  [SCHEMA_ROUTE_INPUT_REQUEST_KEY]?: {
    params: unknown
    query: unknown
    payload: unknown
  }
}
