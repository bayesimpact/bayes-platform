import type { EntityManager } from "typeorm"
import { ORGANIZATION_ROLES } from "./rbac.constants"
import { Role } from "./role.entity"

export async function resolveOrganizationRoleId(
  manager: EntityManager,
  role: keyof typeof ORGANIZATION_ROLES,
): Promise<string | null> {
  const roleKey = ORGANIZATION_ROLES[role]
  const rbacRole = await manager.getRepository(Role).findOne({ where: { key: roleKey } })
  return rbacRole?.id ?? null
}
