import type { BaseAgentSessionTypeDto } from "@caseai-connect/api-contracts"
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import { CSV_EXTRACTION_RUN_PLAYGROUND_PERMISSION } from "@/domains/rbac/rbac.constants"
import type { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"

type GuardedRequest = EndpointRequestWithProject & {
  agentCsvExtractionRun?: AgentCsvExtractionRun
  body?: unknown
  query?: unknown
}

/**
 * Playground runs belong to the Studio surface, so on top of the route's `csv_extraction_run.*`
 * permission they need `csv_extraction_run.playground` on the project. The run type comes from
 * the request, which `@CheckPermission` cannot see, hence this guard after `CheckPermissionGuard`.
 */
@Injectable()
export class AgentCsvExtractionRunPlaygroundGuard implements CanActivate {
  constructor(private readonly permissionService: PermissionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as GuardedRequest

    if (resolveRunType(request) !== "playground") return true

    const isAllowed = await this.permissionService.has(
      request.user.id,
      CSV_EXTRACTION_RUN_PLAYGROUND_PERMISSION,
      { type: "project", id: request.project.id },
    )
    if (!isAllowed) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }

    return true
  }
}

/**
 * The run type the request acts on: the loaded run's own type when the route targets one,
 * otherwise the type the client asks for (createOne payload, getAll query). A request naming an
 * unknown type is rejected outright; routes that carry no type (status stream, file columns) are
 * not type-scoped and resolve to undefined.
 */
function resolveRunType(request: GuardedRequest): BaseAgentSessionTypeDto | undefined {
  if (request.agentCsvExtractionRun) return request.agentCsvExtractionRun.type

  const requestedType = extractRequestedType(request)
  if (requestedType === undefined) return undefined
  if (requestedType !== "live" && requestedType !== "playground") {
    throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  }
  return requestedType
}

function extractRequestedType(request: GuardedRequest): string | undefined {
  const body = typeof request.body === "object" && request.body !== null ? request.body : undefined
  const payload =
    body && "payload" in body && typeof body.payload === "object" && body.payload !== null
      ? body.payload
      : undefined
  if (payload && "type" in payload && typeof payload.type === "string") return payload.type

  const query =
    typeof request.query === "object" && request.query !== null ? request.query : undefined
  if (query && "type" in query && typeof query.type === "string") return query.type

  return undefined
}
