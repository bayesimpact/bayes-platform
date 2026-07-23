import type { EntityManager } from "typeorm"
import { PROJECT_ROLES } from "./rbac.constants"
import { Role } from "./role.entity"

export async function resolveProjectRoleId(
  manager: EntityManager,
  role: keyof typeof PROJECT_ROLES,
): Promise<string | null> {
  const roleKey = PROJECT_ROLES[role]
  const rbacRole = await manager.getRepository(Role).findOne({ where: { key: roleKey } })
  return rbacRole?.id ?? null
}
