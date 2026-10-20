import type { AnySchemaRoute } from "@caseai-connect/desk-contracts"
import { type ExecutionContext, InternalServerErrorException } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"

export const SCHEMA_ROUTE_KEY = "schema_route"

/** The route `@SchemaRoute` put on the handler. The guard and the interceptor run on schema routes only. */
export function getSchemaRoute(reflector: Reflector, context: ExecutionContext): AnySchemaRoute {
  const route = reflector.get<AnySchemaRoute | undefined>(SCHEMA_ROUTE_KEY, context.getHandler())
  if (!route) {
    throw new InternalServerErrorException("This handler is not declared with @SchemaRoute")
  }
  return route
}
