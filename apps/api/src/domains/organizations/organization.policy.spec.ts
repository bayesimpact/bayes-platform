import { userFactory } from "@/domains/users/user.factory"
import { organizationMembershipFactory } from "./memberships/organization-membership.factory"
import { organizationFactory } from "./organization.factory"
import { OrganizationPolicy } from "./organization.policy"

describe("OrganizationPolicy", () => {
  beforeAll(() => {
    process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = "@bayesimpact.org"
  })

  afterAll(() => {
    delete process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN
  })

  describe("canCreate", () => {
    it("should return true for emails ending with @bayesimpact.org", () => {
      const user = userFactory.build({ email: "member@bayesimpact.org" })
      const policy = new OrganizationPolicy(user)

      expect(policy.canCreate()).toBe(true)
    })

    it("should return true for uppercase domain and surrounding spaces", () => {
      const user = userFactory.build({ email: "  member@BAYESIMPACT.ORG  " })
      const policy = new OrganizationPolicy(user)

      expect(policy.canCreate()).toBe(true)
    })

    it("should return false for other email domains", () => {
      const user = userFactory.build({ email: "member@example.org" })
      const policy = new OrganizationPolicy(user)

      expect(policy.canCreate()).toBe(false)
    })
  })

  describe("canUpdate", () => {
    it("should return true for owner", () => {
      const user = userFactory.build()
      const organization = organizationFactory.build()
      const membership = organizationMembershipFactory
        .owner()
        .transient({ user, organization })
        .build()
      const policy = new OrganizationPolicy(user, membership)

      expect(policy.canUpdate()).toBe(true)
    })

    it("should return true for admin", () => {
      const user = userFactory.build()
      const organization = organizationFactory.build()
      const membership = organizationMembershipFactory
        .admin()
        .transient({ user, organization })
        .build()
      const policy = new OrganizationPolicy(user, membership)

      expect(policy.canUpdate()).toBe(true)
    })

    it("should return false for member", () => {
      const user = userFactory.build()
      const organization = organizationFactory.build()
      const membership = organizationMembershipFactory
        .member()
        .transient({ user, organization })
        .build()
      const policy = new OrganizationPolicy(user, membership)

      expect(policy.canUpdate()).toBe(false)
    })

    it("should return false when no membership", () => {
      const user = userFactory.build()
      const policy = new OrganizationPolicy(user, null)

      expect(policy.canUpdate()).toBe(false)
    })
  })
})
