import type { AnySchemaRoute } from "@caseai-connect/desk-contracts"
import { createParamDecorator, type ExecutionContext } from "@nestjs/common"
import type { z } from "zod"
import type { SchemaRouteRequest } from "./schema-input.guard"

/** What a handler of `TRoute` receives through `@SchemaInput()`: each part as its schema outputs it. */
export type SchemaRouteInput<TRoute extends AnySchemaRoute> = {
  params: z.output<TRoute["schemas"]["params"]>
  query: z.output<TRoute["schemas"]["query"]>
  body: z.output<TRoute["schemas"]["body"]> extends { payload: infer TPayload }
    ? TPayload
    : undefined
}

/** The params, query and body that `SchemaInputGuard` parsed, typed with `SchemaRouteInput<typeof route>`. */
export const SchemaInput = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<SchemaRouteRequest>().schemaInput,
)
