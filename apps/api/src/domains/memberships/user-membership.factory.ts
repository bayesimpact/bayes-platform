import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
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
