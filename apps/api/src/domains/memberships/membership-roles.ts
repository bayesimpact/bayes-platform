import type { MembershipRoleDto } from "@caseai-connect/api-contracts"
import { CATALOG_ROLE_KEYS, type RoleScopeType } from "@/domains/rbac/rbac.constants"
import type { UserMembership } from "./user-membership.entity"

/** One role a person holds on a resource: a `user_membership` row and the catalog role it holds. */
export type MembershipRole = {
  membershipId: string
  roleId: string
  key: string
  name: string
  scopeType: RoleScopeType
}

/** Every row a person holds on one resource, oldest first. */
export type MembershipRowGroup = {
  /** The oldest row: its id stands for the person's membership on the resource. */
  oldest: UserMembership
  rows: UserMembership[]
  roles: MembershipRole[]
  /** The latest update of any of the rows. */
  updatedAt: Date
}

const CATALOG_ORDER: ReadonlyMap<string, number> = new Map(
  CATALOG_ROLE_KEYS.map((roleKey, index) => [roleKey, index]),
)

function compareRows(left: UserMembership, right: UserMembership): number {
  const byDate = left.createdAt.getTime() - right.createdAt.getTime()
  return byDate !== 0 ? byDate : left.id.localeCompare(right.id)
}

function compareRoles(left: MembershipRole, right: MembershipRole): number {
  const leftOrder = CATALOG_ORDER.get(left.key) ?? Number.MAX_SAFE_INTEGER
  const rightOrder = CATALOG_ORDER.get(right.key) ?? Number.MAX_SAFE_INTEGER
  return leftOrder !== rightOrder ? leftOrder - rightOrder : left.key.localeCompare(right.key)
}

/**
 * Groups `user_membership` rows by person and resource, in the order each group first appears.
 * Rows must be loaded with their `rbacRole` relation. A row without a role (never backfilled)
 * still makes the person a member, with no role from that row.
 */
export function groupMembershipRows(rows: UserMembership[]): MembershipRowGroup[] {
  const groups = new Map<string, UserMembership[]>()
  for (const row of rows) {
    const groupKey = `${row.userId}:${row.resourceType}:${row.resourceId}`
    const group = groups.get(groupKey)
    if (group) group.push(row)
    else groups.set(groupKey, [row])
  }

  return [...groups.values()].flatMap((groupRows) => {
    const sortedRows = [...groupRows].sort(compareRows)
    const [oldest] = sortedRows
    if (!oldest) return []
    const roles = sortedRows
      .flatMap((row): MembershipRole[] =>
        row.rbacRole
          ? [
              {
                membershipId: row.id,
                roleId: row.rbacRole.id,
                key: row.rbacRole.key,
                name: row.rbacRole.name,
                scopeType: row.rbacRole.scopeType,
              },
            ]
          : [],
      )
      .sort(compareRoles)
    const updatedAt = new Date(Math.max(...sortedRows.map((row) => row.updatedAt.getTime())))
    return [{ oldest, rows: sortedRows, roles, updatedAt }]
  })
}

export function hasRole(holder: { roles: MembershipRole[] }, roleKey: string): boolean {
  return holder.roles.some((role) => role.key === roleKey)
}

export function listRoleIds(holders: { roles: MembershipRole[] }[]): string[] {
  return [...new Set(holders.flatMap((holder) => holder.roles.map((role) => role.roleId)))]
}

export function toMembershipRoleDto(role: MembershipRole): MembershipRoleDto {
  return {
    membershipId: role.membershipId,
    key: role.key,
    name: role.name,
    scopeType: role.scopeType,
  }
}

/** The union of the permissions the roles grant, sorted. */
export function unionRolePermissions(
  roles: MembershipRole[],
  permissionsByRoleId: ReadonlyMap<string, { permissions: string[] }>,
): string[] {
  const permissions = new Set<string>()
  for (const role of roles) {
    for (const permission of permissionsByRoleId.get(role.roleId)?.permissions ?? []) {
      permissions.add(permission)
    }
  }
  return [...permissions].sort()
}
