import { randomUUID } from "node:crypto"
import type { RbacRoleName } from "@/domains/rbac/rbac.constants"
import type { UserRole } from "@/domains/rbac/user-role.entity"
import type { AllRepositories } from "./test-all-repositories"

/**
 * Post Phase-4 Checkpoint H: tests write directly to `user_role` instead of the
 * legacy membership tables. This helper resolves the role id by name and inserts
 * a `user_role` row with optional id / timestamp / scope overrides.
 *
 * Returns the saved `UserRole` so call sites can read `.id` / `.createdAt`.
 */
export async function grantUserRole({
  repositories,
  userId,
  roleName,
  conditions,
  id,
  createdAt,
  updatedAt,
}: {
  repositories: Pick<AllRepositories, "roleRepository" | "userRoleRepository">
  userId: string
  roleName: RbacRoleName
  conditions: Record<string, unknown>
  id?: string
  createdAt?: Date
  updatedAt?: Date
}): Promise<UserRole> {
  const role = await repositories.roleRepository.findOneByOrFail({ name: roleName })
  const now = new Date()
  return repositories.userRoleRepository.save(
    repositories.userRoleRepository.create({
      id: id ?? randomUUID(),
      userId,
      roleId: role.id,
      conditions,
      createdAt: createdAt ?? now,
      updatedAt: updatedAt ?? createdAt ?? now,
    }),
  )
}
