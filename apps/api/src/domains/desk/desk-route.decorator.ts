import type { AnySchemaRoute } from "@caseai-connect/desk-contracts"
import { SchemaRoute, type SchemaRouteOptions } from "@/common/schema-route/schema-route.decorator"
import { DeskAccessGuard } from "./desk-access.guard"

/**
 * Declares a Desk endpoint: `@SchemaRoute` with the Desk access guard at the end of the chain. Desk
 * controllers declare no guard of their own, since a controller guard runs before the handler's.
 */
export function DeskRoute(route: AnySchemaRoute, options: SchemaRouteOptions): MethodDecorator {
  return SchemaRoute(route, { ...options, guards: [DeskAccessGuard] })
}
