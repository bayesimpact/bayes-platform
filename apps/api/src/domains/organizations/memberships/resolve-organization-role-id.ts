import type { EntityManager } from "typeorm"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { Role } from "@/domains/rbac/role.entity"
import type { OrganizationMembershipRole } from "./organization-membership.types"

export async function resolveOrganizationRoleId(
  manager: EntityManager,
  role: OrganizationMembershipRole,
): Promise<string | null> {
  const roleKey = ORGANIZATION_ROLES[role]
  const rbacRole = await manager.getRepository(Role).findOne({ where: { key: roleKey } })
  return rbacRole?.id ?? null
}
