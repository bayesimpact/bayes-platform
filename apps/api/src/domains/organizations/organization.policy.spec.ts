import { userFactory } from "@/domains/users/user.factory"
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
})
