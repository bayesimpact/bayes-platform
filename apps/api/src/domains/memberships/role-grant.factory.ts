import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import { In } from "typeorm"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Role } from "@/domains/rbac/role.entity"
import type { User } from "@/domains/users/user.entity"
import type { RoleGrant, RoleGrantResourceType } from "./role-grant.entity"

type RoleGrantTransientParams = {
  user?: User
  organization?: Organization
}

/** Builds a raw `role_grant` row. Pass `roleId`: a row is the role it holds. */
class RoleGrantFactory extends Factory<RoleGrant, RoleGrantTransientParams> {}

export const roleGrantFactory = RoleGrantFactory.define(({ params, transientParams }) => {
  const userId = params.userId ?? transientParams.user?.id
  const resourceType = (params.resourceType ?? "organization") as RoleGrantResourceType
  const resourceId =
    params.resourceId !== undefined ? params.resourceId : (transientParams.organization?.id ?? null)

  if (!userId) throw new Error("userId param or user transient is required")
  if (!params.roleId) throw new Error("roleId param is required: a row is the role it holds")
  if (resourceType !== "global" && !resourceId) {
    throw new Error("resourceId param or organization transient is required")
  }

  const now = new Date()
  return {
    id: params.id ?? randomUUID(),
    userId,
    resourceType,
    resourceId,
    roleId: params.roleId,
    rbacRole: params.rbacRole as Role,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
    deletedAt: params.deletedAt ?? null,
    user: transientParams.user as User,
  } satisfies RoleGrant
})

/**
 * Saves one `role_grant` row per role key on a resource, the first one under `id`. Throws
 * without a key, or with a key the catalog lacks. Returns the rows in the order of `roleKeys`.
 */
export const saveRoleGrantRows = async ({
  repositories,
  id,
  userId,
  resourceType,
  resourceId,
  roleKeys,
}: {
  repositories: AllRepositories
  id: string
  userId: string
  resourceType: RoleGrantResourceType
  resourceId: string
  roleKeys: readonly string[]
}) => {
  if (roleKeys.length === 0) throw new Error("A membership needs at least one role key")
  const roles = await repositories.roleRepository.find({ where: { key: In([...roleKeys]) } })
  const missingRoleKey = roleKeys.find((roleKey) => !roles.some((role) => role.key === roleKey))
  if (missingRoleKey) {
    throw new Error(`Role ${missingRoleKey} not found: call ensureRbacCatalog in this spec`)
  }
  const savedRows: RoleGrant[] = []
  for (const [index, roleKey] of roleKeys.entries()) {
    const role = roles.find((candidate) => candidate.key === roleKey) as (typeof roles)[number]
    savedRows.push(
      await repositories.roleGrantRepository.save(
        roleGrantFactory.build({
          id: index === 0 ? id : randomUUID(),
          userId,
          resourceType,
          resourceId,
          roleId: role.id,
        }),
      ),
    )
  }
  return savedRows
}
