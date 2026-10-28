import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import { In } from "typeorm"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { User } from "@/domains/users/user.entity"
import type { UserMembership, UserMembershipResourceType } from "./user-membership.entity"

type UserMembershipTransientParams = {
  user?: User
  organization?: Organization
}

/** Builds a raw `user_membership` row. Pass `roleId`: a row is the role it holds. */
class UserMembershipFactory extends Factory<UserMembership, UserMembershipTransientParams> {}

export const userMembershipFactory = UserMembershipFactory.define(({ params, transientParams }) => {
  const userId = params.userId ?? transientParams.user?.id
  const resourceType = (params.resourceType ?? "organization") as UserMembershipResourceType
  const resourceId =
    params.resourceId !== undefined ? params.resourceId : (transientParams.organization?.id ?? null)

  if (!userId) throw new Error("userId param or user transient is required")
  if (resourceType !== "global" && !resourceId) {
    throw new Error("resourceId param or organization transient is required")
  }

  const now = new Date()
  return {
    id: params.id ?? randomUUID(),
    userId,
    resourceType,
    resourceId,
    // Only the specs of past migrations, which read the legacy column, pass it.
    role: params.role ?? null,
    roleId: params.roleId ?? null,
    rbacRole: null,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
    deletedAt: params.deletedAt ?? null,
    user: transientParams.user as User,
  } satisfies UserMembership
})

/**
 * Saves one `user_membership` row per role key on a resource, the first one under `id`. Throws
 * without a key. A key the catalog lacks gives a row without a role, or throws with
 * `requireCatalogRoles`. Returns the rows in the order of `roleKeys`.
 */
export const saveUserMembershipRows = async ({
  repositories,
  id,
  userId,
  resourceType,
  resourceId,
  roleKeys,
  requireCatalogRoles = false,
}: {
  repositories: AllRepositories
  id: string
  userId: string
  resourceType: UserMembershipResourceType
  resourceId: string
  roleKeys: readonly string[]
  requireCatalogRoles?: boolean
}) => {
  if (roleKeys.length === 0) throw new Error("A membership needs at least one role key")
  const roles = await repositories.roleRepository.find({ where: { key: In([...roleKeys]) } })
  const missingRoleKey = roleKeys.find((roleKey) => !roles.some((role) => role.key === roleKey))
  if (requireCatalogRoles && missingRoleKey) {
    throw new Error(`Role ${missingRoleKey} not found: call ensureRbacCatalog in this spec`)
  }
  const savedRows: UserMembership[] = []
  for (const [index, roleKey] of roleKeys.entries()) {
    const role = roles.find((candidate) => candidate.key === roleKey)
    savedRows.push(
      await repositories.userMembershipRepository.save(
        userMembershipFactory.build({
          id: index === 0 ? id : randomUUID(),
          userId,
          resourceType,
          resourceId,
          roleId: role?.id ?? null,
        }),
      ),
    )
  }
  return savedRows
}
