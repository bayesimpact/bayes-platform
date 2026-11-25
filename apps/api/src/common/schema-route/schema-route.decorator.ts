import {
  applyDecorators,
  type CanActivate,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  RequestMethod,
  SetMetadata,
  Sse,
  type Type,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { UserGuard } from "@/domains/users/user.guard"
import {
  type AnySchemaRoute,
  type AnyStreamRoute,
  SCHEMA_ROUTE_METADATA_KEY,
  type SchemaRouteMethod,
  type SchemaRouteOptions,
} from "./schema-route.types"
import { SchemaRouteInputGuard } from "./schema-route-input.guard"
import { SchemaRouteResponseInterceptor } from "./schema-route-response.interceptor"

const METHOD_DECORATORS = {
  get: Get,
  post: Post,
  put: Put,
  patch: Patch,
  delete: Delete,
} satisfies Record<SchemaRouteMethod, (path: string) => MethodDecorator>

function isStreamRoute(route: AnySchemaRoute | AnyStreamRoute): route is AnyStreamRoute {
  return "event" in route.schemas
}

/**
 * Serves a route of a contracts package on one handler. It sets the HTTP method and
 * path, the status code, the guard chain (`JwtAuthGuard`, `UserGuard`, the input guard, then
 * `ResourceContextGuard` and `CheckPermissionGuard` when the options ask for them), the required
 * contexts, the permission, the tracked activity and the response interceptor. A stream route
 * answers 200 with server-sent events, records no activity and has no response interceptor.
 *
 * `docs/schema-routes.md` explains the order of the guards, the options and how to write a handler.
 */
export function SchemaRoute(
  route: AnySchemaRoute | AnyStreamRoute,
  options: SchemaRouteOptions,
): MethodDecorator {
  const guards: Type<CanActivate>[] = [JwtAuthGuard, UserGuard, SchemaRouteInputGuard]
  const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [
    SetMetadata(SCHEMA_ROUTE_METADATA_KEY, route),
  ]

  // The permission guard reads the resource the context resolvers put on the request, and a
  // context loaded with no permission check would reach resources unchecked.
  if (options.permission === "signed-in") {
    if (options.context?.length) {
      throw new Error(`${route.path}: a "signed-in" route loads no context`)
    }
  } else if (!options.context?.length) {
    throw new Error(`${route.path}: a scoped permission needs a context`)
  }

  if (options.context?.length) {
    guards.push(ResourceContextGuard)
    decorators.push(RequireContext(...options.context))
  }
  if (options.permission !== "signed-in") {
    guards.push(CheckPermissionGuard)
    decorators.push(CheckPermission(options.permission.key, options.permission.on))
  }
  decorators.push(UseGuards(...guards))

  if (isStreamRoute(route)) {
    if (options.activity) {
      throw new Error(`${route.path}: a stream route records no activity`)
    }
    if (options.status !== undefined && options.status !== HttpStatus.OK) {
      throw new Error(`${route.path}: a stream route answers 200`)
    }
    const method = route.method === "post" ? RequestMethod.POST : RequestMethod.GET
    decorators.push(Sse(route.path, { method }), HttpCode(HttpStatus.OK))
    return applyDecorators(...decorators)
  }

  decorators.push(
    METHOD_DECORATORS[route.method](route.path),
    UseInterceptors(SchemaRouteResponseInterceptor),
  )
  if (options.status !== undefined) {
    decorators.push(HttpCode(options.status))
  }
  if (options.activity) {
    decorators.push(TrackActivity(options.activity))
  }
  return applyDecorators(...decorators)
}
