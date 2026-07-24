import { SetMetadata } from "@nestjs/common"
import type { PermissionResourceType } from "./permission.types"

export const CHECK_PERMISSION_KEY = "check_permission"

export type CheckPermissionMetadata = {
  permission: string
  resourceType?: PermissionResourceType
}

export function CheckPermission(permission: string): MethodDecorator
export function CheckPermission(
  permission: string,
  resourceType: PermissionResourceType,
): MethodDecorator
export function CheckPermission(permission: string, resourceType?: PermissionResourceType) {
  return SetMetadata(CHECK_PERMISSION_KEY, {
    permission,
    resourceType,
  } satisfies CheckPermissionMetadata)
}
