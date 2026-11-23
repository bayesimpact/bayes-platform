import { createParamDecorator, type ExecutionContext } from "@nestjs/common"
import {
  type RequestWithSchemaRouteInput,
  SCHEMA_ROUTE_INPUT_REQUEST_KEY,
} from "./schema-route.types"

const routeInput = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithSchemaRouteInput>()
  const input = request[SCHEMA_ROUTE_INPUT_REQUEST_KEY]
  if (!input) {
    throw new Error("@RouteInput() reads only a handler declared with @SchemaRoute")
  }
  return input
})

/**
 * Gives the handler the params, query and payload that the input guard parsed:
 * `@RouteInput() input: SchemaRouteInput<typeof route>`.
 */
export const RouteInput: () => ParameterDecorator = () => routeInput()
