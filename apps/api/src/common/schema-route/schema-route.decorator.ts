import type { AnySchemaRoute, SchemaRouteMethod } from "@caseai-connect/desk-contracts"
import {
  applyDecorators,
  type CanActivate,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  SetMetadata,
  type Type,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { AddContext, type ContextResource } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import type { PermissionResourceType } from "@/domains/rbac/permission.types"
import type { CatalogPermission } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { SchemaInputGuard } from "./schema-input.guard"
import { SchemaResponseInterceptor } from "./schema-response.interceptor"
import { SCHEMA_ROUTE_KEY } from "./schema-route.metadata"

/** The permission of a route that names no resource and serves any signed-in person, such as `desk/me`. */
export const SIGNED_IN = "signed-in" as const

export type SchemaRoutePermission =
  | typeof SIGNED_IN
  | { key: CatalogPermission; resource: PermissionResourceType }

export type SchemaRouteOptions = {
  /** Required, so that no route skips its permission check by omission. */
  permission: SchemaRoutePermission
}

/**
 * The context each path param resolves, through the resolvers of `ContextModule`. A path names its
 * resources with these params, so the route needs no `@RequireContext`. A param whose resolver is not
 * registered fails loudly with a 500 on the first request.
 */
const CONTEXT_BY_PATH_PARAM: Record<string, ContextResource> = {
  organizationId: "organization",
  projectId: "project",
  agentId: "agent",
  agentSessionId: "agentSession",
  agentCsvExtractionRunId: "agentCsvExtractionRun",
}

const METHOD_DECORATORS: Record<SchemaRouteMethod, (path: string) => MethodDecorator> = {
  get: Get,
  post: Post,
  put: Put,
  patch: Patch,
  delete: Delete,
}

/**
 * Declares a handler for a route of `defineSchemaRoute`. It applies the HTTP method, the path and the
 * status code, resolves the resources the path names, and runs, in this order: `JwtAuthGuard`,
 * `UserGuard`, `SchemaInputGuard`, `ResourceContextGuard`, `CheckPermissionGuard`, then the
 * `guards` given (an app's access guard), and `SchemaResponseInterceptor` on the response. Handlers
 * read their input with `@SchemaInput()`.
 */
export function SchemaRoute(
  route: AnySchemaRoute,
  options: SchemaRouteOptions & { guards?: Type<CanActivate>[] },
): MethodDecorator {
  const { permission, guards = [] } = options
  const contextResources = readPathParams(route.path).flatMap((param) => {
    const resource = CONTEXT_BY_PATH_PARAM[param]
    return resource ? [resource] : []
  })
  return applyDecorators(
    METHOD_DECORATORS[route.method](route.path),
    HttpCode(route.method === "post" ? 201 : 200),
    SetMetadata(SCHEMA_ROUTE_KEY, route),
    AddContext(...contextResources),
    ...(permission === SIGNED_IN ? [] : [CheckPermission(permission.key, permission.resource)]),
    UseGuards(
      JwtAuthGuard,
      UserGuard,
      SchemaInputGuard,
      ResourceContextGuard,
      CheckPermissionGuard,
      ...guards,
    ),
    UseInterceptors(SchemaResponseInterceptor),
  )
}

function readPathParams(path: string): string[] {
  return [...path.matchAll(/:(\w+)/g)].flatMap((match) => (match[1] ? [match[1]] : []))
}
