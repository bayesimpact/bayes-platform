import type { EntityManager } from "typeorm"
import { Role } from "./role.entity"

/**
 * The id of a catalog role, by key. A membership row is its role, so writing one without it is a
 * bug: the catalog is seeded in every environment, and in tests by `ensureRbacCatalog`.
 */
export async function requireRoleId(manager: EntityManager, roleKey: string): Promise<string> {
  const rbacRole = await manager.getRepository(Role).findOne({ where: { key: roleKey } })
  if (!rbacRole) throw new Error(`Role ${roleKey} not found: is the RBAC catalog seeded?`)
  return rbacRole.id
}
