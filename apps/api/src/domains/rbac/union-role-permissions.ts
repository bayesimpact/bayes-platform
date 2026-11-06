import type { ResolvedRole } from "./permission.types"

/** The union of the permissions the roles grant, sorted. */
export function unionRolePermissions(
  roles: { roleId: string }[],
  rolesById: ReadonlyMap<string, Pick<ResolvedRole, "permissions">>,
): string[] {
  const permissions = new Set<string>()
  for (const role of roles) {
    for (const permission of rolesById.get(role.roleId)?.permissions ?? []) {
      permissions.add(permission)
    }
  }
  return [...permissions].sort()
}
