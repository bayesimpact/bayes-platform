import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { User } from "@/domains/users/user.entity"
import type { UserMembership, UserMembershipResourceType } from "./user-membership.entity"

type UserMembershipTransientParams = {
  user?: User
  organization?: Organization
}

class UserMembershipFactory extends Factory<UserMembership, UserMembershipTransientParams> {
  member() {
    return this.params({ role: "member" })
  }

  admin() {
    return this.params({ role: "admin" })
  }

  owner() {
    return this.params({ role: "owner" })
  }
}

export const userMembershipFactory = UserMembershipFactory.define(({ params, transientParams }) => {
  const userId = params.userId ?? transientParams.user?.id
  const resourceId = params.resourceId ?? transientParams.organization?.id
  if (!userId) throw new Error("userId param or user transient is required")
  if (!resourceId) throw new Error("resourceId param or organization transient is required")

  const now = new Date()
  return {
    id: params.id ?? randomUUID(),
    userId,
    resourceType: (params.resourceType ?? "organization") as UserMembershipResourceType,
    resourceId,
    role: params.role ?? "member",
    roleId: params.roleId ?? null,
    rbacRole: null,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
    deletedAt: params.deletedAt ?? null,
    user: transientParams.user as User,
  } satisfies UserMembership
})
