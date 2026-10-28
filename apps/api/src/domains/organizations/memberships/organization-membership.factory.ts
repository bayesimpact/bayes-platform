import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { saveUserMembershipRows } from "@/domains/memberships/user-membership.factory"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "../../users/user.factory"
import type { Organization } from "../organization.entity"
import type {
  OrganizationMembershipFixture,
  OrganizationRoleKey,
} from "./organization-membership.types"

type OrganizationMembershipTransientParams = {
  user: User
  organization: Organization
}

class OrganizationMembershipFactory extends Factory<
  OrganizationMembershipFixture,
  OrganizationMembershipTransientParams
> {
  withRoles(...roleKeys: OrganizationRoleKey[]) {
    return this.params({ roleKeys })
  }
}

export const organizationMembershipFactory = OrganizationMembershipFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.user) {
      throw new Error("user transient is required")
    }
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      userId: transientParams.user.id,
      organizationId: transientParams.organization.id,
      roleKeys: (params.roleKeys as OrganizationRoleKey[] | undefined) ?? [
        ORGANIZATION_ROLES.member,
      ],
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt || null,
      user: transientParams.user,
      organization: transientParams.organization,
    } satisfies OrganizationMembershipFixture
  },
)

/**
 * Saves an organization membership to `user_membership`, one row per role key.
 */
export const saveOrgMembership = async ({
  repositories,
  membership,
}: {
  repositories: AllRepositories
  membership: OrganizationMembershipFixture
}) => {
  const [saved] = await saveUserMembershipRows({
    repositories,
    id: membership.id,
    userId: membership.userId,
    resourceType: "organization",
    resourceId: membership.organizationId,
    roleKeys: membership.roleKeys,
  })
  return { ...membership, id: saved?.id ?? membership.id }
}

export const addUserToOrganization = async ({
  repositories,
  organization,
  membership,
  user,
}: {
  repositories: AllRepositories
  organization: Organization
  user?: Partial<User>
  membership?: Partial<OrganizationMembershipFixture>
}) => {
  const newUser = userFactory.build(user)
  await repositories.userRepository.save(newUser)
  const newMembership = await saveOrgMembership({
    repositories,
    membership: organizationMembershipFactory
      .transient({ user: newUser, organization })
      .build(membership),
  })
  return { user: newUser, membership: newMembership }
}
