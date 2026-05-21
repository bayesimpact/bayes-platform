import type { User } from "@/domains/users/user.entity"

export class OrganizationPolicy {
  constructor(private readonly user: User) {}

  canCreate(): boolean {
    const allowedDomain = process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN?.trim().toLowerCase()
    if (!allowedDomain) return false
    const normalizedEmail = this.user.email.trim().toLowerCase()
    return normalizedEmail.endsWith(allowedDomain)
  }
}
