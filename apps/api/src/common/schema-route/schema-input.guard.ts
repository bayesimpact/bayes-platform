import type { ErrorIssueOutputDto } from "@caseai-connect/desk-contracts"
import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { z } from "zod"
import { getSchemaRoute } from "./schema-route.metadata"

/** The parsed parts of a request, which `@SchemaInput()` hands to the handler. */
export type ParsedSchemaInput = {
  params: unknown
  query: unknown
  body: unknown
}

export type SchemaRouteRequest = {
  params?: unknown
  query?: unknown
  body?: unknown
  schemaInput?: ParsedSchemaInput
}

type RequestPart = "params" | "query" | "body"

/**
 * Parses the params, the query and the body of a request with the schemas of its route, before any
 * context resolver reads them. A part the route does not declare must be empty. A failure answers
 * 400 with the issues, so a malformed id never reaches the database.
 */
@Injectable()
export class SchemaInputGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const route = getSchemaRoute(this.reflector, context)
    const request = context.switchToHttp().getRequest<SchemaRouteRequest>()

    // An absent body counts as empty, so a route that reads none rejects any body sent to it.
    const params = route.schemas.params.safeParse(request.params ?? {})
    const query = route.schemas.query.safeParse(request.query ?? {})
    const body = route.schemas.body.safeParse(request.body ?? {})

    const issues = [
      ...toIssues("params", params),
      ...toIssues("query", query),
      ...toIssues("body", body),
    ]
    if (issues.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
        error: "Bad Request",
        issues,
      })
    }

    request.schemaInput = {
      params: params.data,
      query: query.data,
      body: readPayload(body.data),
    }
    return true
  }
}

/** The issues of one part, with paths that start with the part's name and skip the body's envelope. */
function toIssues(part: RequestPart, result: z.ZodSafeParseResult<unknown>): ErrorIssueOutputDto[] {
  if (result.success) return []
  return result.error.issues.map((issue) => {
    const path = part === "body" && issue.path[0] === "payload" ? issue.path.slice(1) : issue.path
    return {
      path: [
        part,
        ...path.map((segment) => (typeof segment === "number" ? segment : String(segment))),
      ],
      code: issue.code,
      message: issue.message,
    }
  })
}

function readPayload(body: unknown): unknown {
  return typeof body === "object" && body !== null && "payload" in body ? body.payload : undefined
}
