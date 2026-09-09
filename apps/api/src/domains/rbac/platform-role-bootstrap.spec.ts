import { isPlatformRoleKey, resolveBootstrapRoles } from "./platform-role-bootstrap"

describe("resolveBootstrapRoles", () => {
  const env = {
    BACKOFFICE_AUTHORIZED_EMAILS: "Admin@Example.org, second@example.org",
    ORGANIZATION_CREATOR_EMAIL_DOMAIN: "@example.org",
  }

  it("gives platform_superadmin and platform_staff to a listed email of the domain", () => {
    expect(resolveBootstrapRoles("admin@example.org", env)).toEqual([
      "platform_superadmin",
      "platform_staff",
    ])
  })

  it("gives platform_staff only to an email of the domain", () => {
    expect(resolveBootstrapRoles("someone@example.org", env)).toEqual(["platform_staff"])
  })

  it("gives nothing to an email outside the list and the domain", () => {
    expect(resolveBootstrapRoles("visitor@other.org", env)).toEqual([])
  })

  it("ignores case and spaces", () => {
    expect(resolveBootstrapRoles("  SECOND@EXAMPLE.ORG ", env)).toEqual([
      "platform_superadmin",
      "platform_staff",
    ])
  })

  it("gives nothing when the variables are unset", () => {
    expect(resolveBootstrapRoles("admin@example.org", {})).toEqual([])
  })

  it("does not match a domain that is only a suffix of another", () => {
    expect(resolveBootstrapRoles("someone@notexample.org", env)).toEqual([])
  })
})

describe("isPlatformRoleKey", () => {
  it("accepts the two global roles only", () => {
    expect(isPlatformRoleKey("platform_staff")).toBe(true)
    expect(isPlatformRoleKey("platform_superadmin")).toBe(true)
    expect(isPlatformRoleKey("org_owner")).toBe(false)
  })
})
