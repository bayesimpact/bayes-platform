import type { OrganizationMembershipContextModel } from "@/domains/organizations/memberships/organization-membership.model"
import type { User } from "@/domains/users/user.entity"

export class OrganizationPolicy {
  constructor(
    private readonly user: User,
    private readonly membership?: OrganizationMembershipContextModel | null,
  ) {}

  canCreate(): boolean {
    const allowedDomain = process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN?.trim().toLowerCase()
    if (!allowedDomain) return false
    const normalizedEmail = this.user.email.trim().toLowerCase()
    return normalizedEmail.endsWith(allowedDomain)
  }

  canUpdate(): boolean {
    if (!this.membership) return false
    return ["owner", "admin"].includes(this.membership.role)
  }
}
