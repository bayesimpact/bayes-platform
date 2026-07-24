export type PermissionResourceType = "organization" | "project" | "agent"

export type PermissionResource = {
  type: PermissionResourceType
  id: string
}
