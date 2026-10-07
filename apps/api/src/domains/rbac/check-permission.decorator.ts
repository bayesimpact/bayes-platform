import { SetMetadata } from "@nestjs/common"
import type { PermissionResourceType } from "./permission.types"
import type { CatalogPermission } from "./rbac.constants"

export const CHECK_PERMISSION_KEY = "check_permission"

export type CheckPermissionMetadata = {
  permission: CatalogPermission
  resourceType?: PermissionResourceType
}

export function CheckPermission(permission: CatalogPermission): MethodDecorator
export function CheckPermission(
  permission: CatalogPermission,
  resourceType: PermissionResourceType,
): MethodDecorator
export function CheckPermission(
  permission: CatalogPermission,
  resourceType?: PermissionResourceType,
) {
  return SetMetadata(CHECK_PERMISSION_KEY, {
    permission,
    resourceType,
  } satisfies CheckPermissionMetadata)
}
