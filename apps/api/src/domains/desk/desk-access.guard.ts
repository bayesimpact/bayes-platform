import { AGENT_READ_PERMISSION, DESK_UI_READ_PERMISSION } from "@caseai-connect/api-contracts"
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { EndpointRequest } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { getSchemaRoute } from "@/common/schema-route/schema-route.metadata"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"

/** The resources the context resolvers put on the request, when the path names them. */
type DeskRequest = EndpointRequest & { project?: { id: string }; agent?: { id: string } }

/**
 * The Desk's own checks, on top of the route's permission (ADR 0031, section 2.13): `desk.ui.read` on
 * the project the path names, and `agent.read` on the agent it names. A caller who cannot read the
 * agent gets the 404 an agent of another project gets, so the Desk does not reveal the project's
 * other agents. A route that names no project, such as `desk/me`, passes.
 */
@Injectable()
export class DeskAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const route = getSchemaRoute(this.reflector, context)
    const request = context.switchToHttp().getRequest<DeskRequest>()

    if (!route.path.includes(":projectId")) return true
    if (!request.project) {
      throw new InternalServerErrorException("The project of a Desk route was not resolved")
    }
    const canOpenDesk = await this.permissionService.has(request.user.id, DESK_UI_READ_PERMISSION, {
      type: "project",
      id: request.project.id,
    })
    if (!canOpenDesk) throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)

    if (!route.path.includes(":agentId")) return true
    if (!request.agent) {
      throw new InternalServerErrorException("The agent of a Desk route was not resolved")
    }
    const canReadAgent = await this.permissionService.has(request.user.id, AGENT_READ_PERMISSION, {
      type: "agent",
      id: request.agent.id,
    })
    if (!canReadAgent) throw new NotFoundException()

    return true
  }
}
