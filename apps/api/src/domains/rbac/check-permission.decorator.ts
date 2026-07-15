import { SetMetadata } from "@nestjs/common"
import type { PermissionResourceType } from "./permission.types"

export const CHECK_PERMISSION_KEY = "check_permission"

export type CheckPermissionMetadata = {
  permission: string
  resourceType: PermissionResourceType
}

export const CheckPermission = (permission: string, resourceType: PermissionResourceType) =>
  SetMetadata(CHECK_PERMISSION_KEY, { permission, resourceType } satisfies CheckPermissionMetadata)
