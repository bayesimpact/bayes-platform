import type { AnySchemaRoute, AnyStreamRoute } from "@caseai-connect/desk-contracts"
import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { Request } from "express"
import type { z } from "zod"
import {
  type RequestWithSchemaRouteInput,
  SCHEMA_ROUTE_INPUT_REQUEST_KEY,
  SCHEMA_ROUTE_METADATA_KEY,
} from "./schema-route.types"

type InputPart = "params" | "query" | "body"

type InputIssue = { path: (string | number)[]; code: string; message: string }

/**
 * Parses the params, query and body of a request with the schemas of the handler's route, before
 * any context resolver runs. It stores the parsed values on the request for `@RouteInput()`, and
 * leaves `request.params` as Express gave them, since the resolvers read them. A refusal answers
 * 400 with Nest's body plus the issues.
 */
@Injectable()
export class SchemaRouteInputGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const route = this.reflector.get<AnySchemaRoute | AnyStreamRoute | undefined>(
      SCHEMA_ROUTE_METADATA_KEY,
      context.getHandler(),
    )
    if (!route) {
      throw new Error("SchemaRouteInputGuard runs only on a handler declared with @SchemaRoute")
    }

    const request = context.switchToHttp().getRequest<Request & RequestWithSchemaRouteInput>()
    const params = route.schemas.params.safeParse(request.params)
    const query = route.schemas.query.safeParse(request.query)
    const body = route.schemas.body.safeParse(request.body ?? {})

    if (!params.success || !query.success || !body.success) {
      const issues = [
        ...toInputIssues("params", params.error),
        ...toInputIssues("query", query.error),
        ...toInputIssues("body", body.error),
      ]
      throw new BadRequestException({
        statusCode: 400,
        message: "Invalid request",
        error: "Bad Request",
        issues,
      })
    }

    request[SCHEMA_ROUTE_INPUT_REQUEST_KEY] = {
      params: params.data,
      query: query.data,
      payload: "payload" in body.data ? body.data.payload : undefined,
    }
    return true
  }
}

function toInputIssues(part: InputPart, error: z.ZodError | undefined): InputIssue[] {
  if (!error) return []
  return error.issues.map((issue) => ({
    path: [
      part,
      ...issue.path.map((segment) => (typeof segment === "symbol" ? String(segment) : segment)),
    ],
    code: issue.code,
    message: issue.message,
  }))
}
