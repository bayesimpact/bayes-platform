import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { User } from "@/domains/users/user.entity"
import type { UserMembership, UserMembershipResourceType } from "./user-membership.entity"

type UserMembershipTransientParams = {
  user: User
  organization: Organization
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
  if (!transientParams.user) {
    throw new Error("user transient is required")
  }
  if (!transientParams.organization) {
    throw new Error("organization transient is required")
  }

  const now = new Date()
  return {
    id: params.id ?? randomUUID(),
    userId: transientParams.user.id,
    resourceType: (params.resourceType ?? "organization") as UserMembershipResourceType,
    resourceId: params.resourceId ?? transientParams.organization.id,
    role: params.role ?? "member",
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
    deletedAt: params.deletedAt ?? null,
    user: transientParams.user,
  } satisfies UserMembership
})
