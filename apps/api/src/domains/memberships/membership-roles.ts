import type { MembershipRoleDto } from "@caseai-connect/api-contracts"
import { CATALOG_ROLE_KEYS, type RoleScopeType } from "@/domains/rbac/rbac.constants"
import type { RoleGrant } from "./role-grant.entity"

/** One role a person holds on a resource: a `role_grant` row and the catalog role it holds. */
export type MembershipRole = {
  membershipId: string
  roleId: string
  key: string
  name: string
  scopeType: RoleScopeType
}

/**
 * A person's membership on one resource: the person, the resource and every role they hold
 * there. There is no membership id: the person and the resource identify it, and each role
 * carries the id of the row that holds it.
 */
export type MembershipRowGroup = {
  userId: string
  resourceId: string | null
  /** The `user` relation of the rows, when it was loaded. */
  user: RoleGrant["user"]
  rows: RoleGrant[]
  roles: MembershipRole[]
  /** When the person got their first role on the resource. */
  createdAt: Date
  /** The latest update of any of the rows. */
  updatedAt: Date
}

const CATALOG_ORDER: ReadonlyMap<string, number> = new Map(
  CATALOG_ROLE_KEYS.map((roleKey, index) => [roleKey, index]),
)

function compareRows(left: RoleGrant, right: RoleGrant): number {
  const byDate = left.createdAt.getTime() - right.createdAt.getTime()
  return byDate !== 0 ? byDate : left.id.localeCompare(right.id)
}

function compareRoles(left: MembershipRole, right: MembershipRole): number {
  const leftOrder = CATALOG_ORDER.get(left.key) ?? Number.MAX_SAFE_INTEGER
  const rightOrder = CATALOG_ORDER.get(right.key) ?? Number.MAX_SAFE_INTEGER
  return leftOrder !== rightOrder ? leftOrder - rightOrder : left.key.localeCompare(right.key)
}

/**
 * Groups `role_grant` rows by person and resource, in the order each group first appears.
 * Rows must be loaded with their `rbacRole` relation. A row without a role (never backfilled)
 * still makes the person a member, with no role from that row.
 */
export function groupMembershipRows(rows: RoleGrant[]): MembershipRowGroup[] {
  const groups = new Map<string, RoleGrant[]>()
  for (const row of rows) {
    const groupKey = `${row.userId}:${row.resourceType}:${row.resourceId}`
    const group = groups.get(groupKey)
    if (group) group.push(row)
    else groups.set(groupKey, [row])
  }

  return [...groups.values()].flatMap((groupRows) => {
    const sortedRows = [...groupRows].sort(compareRows)
    const [first] = sortedRows
    if (!first) return []
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
    return [
      {
        userId: first.userId,
        resourceId: first.resourceId,
        user: first.user,
        rows: sortedRows,
        roles,
        createdAt: first.createdAt,
        updatedAt,
      },
    ]
  })
}

/** The resource of a scoped membership; global rows have no resource. */
export function resourceIdOf(group: MembershipRowGroup): string {
  if (group.resourceId === null) {
    throw new Error(`Membership of user ${group.userId} is missing resource_id`)
  }
  return group.resourceId
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
