import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { EndpointRequest } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  CHECK_PERMISSION_KEY,
  type CheckPermissionMetadata,
} from "@/domains/rbac/check-permission.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "./permission.service"
import { resolvePermissionResourceId } from "./resolve-permission-resource-id"

@Injectable()
export class CheckPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<CheckPermissionMetadata | undefined>(
      CHECK_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!metadata) {
      return true
    }

    const request = context.switchToHttp().getRequest() as EndpointRequest

    const isAllowed = metadata.resourceType
      ? await this.checkScopedPermission(request, {
          permission: metadata.permission,
          resourceType: metadata.resourceType,
        })
      : await this.permissionService.hasGlobal(request.user.id, metadata.permission)

    if (!isAllowed) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }

    return true
  }

  private async checkScopedPermission(
    request: EndpointRequest,
    metadata: CheckPermissionMetadata & {
      resourceType: NonNullable<CheckPermissionMetadata["resourceType"]>
    },
  ): Promise<boolean> {
    const resourceId = resolvePermissionResourceId(
      request as Parameters<typeof resolvePermissionResourceId>[0],
      metadata.resourceType,
    )
    if (!resourceId) {
      throw new BadRequestException(`Missing ${metadata.resourceType} context for permission check`)
    }

    return this.permissionService.has(request.user.id, metadata.permission, {
      type: metadata.resourceType,
      id: resourceId,
    })
  }
}
