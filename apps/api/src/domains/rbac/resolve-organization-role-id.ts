import type { EntityManager } from "typeorm"
import { ORGANIZATION_ROLES } from "./rbac.constants"
import { requireRoleId } from "./resolve-role-id"

export async function resolveOrganizationRoleId(
  manager: EntityManager,
  role: keyof typeof ORGANIZATION_ROLES,
): Promise<string> {
  return requireRoleId(manager, ORGANIZATION_ROLES[role])
}
