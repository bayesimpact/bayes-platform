import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { PlatformRoleBootstrapService } from "@/domains/rbac/platform-role-bootstrap.service"
import { PLATFORM_STAFF_ROLE, PLATFORM_SUPERADMIN_ROLE } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"

describe("PlatformRoleBootstrapService", () => {
  let service: PlatformRoleBootstrapService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  const savedEnv = {
    BACKOFFICE_AUTHORIZED_EMAILS: process.env.BACKOFFICE_AUTHORIZED_EMAILS,
    ORGANIZATION_CREATOR_EMAIL_DOMAIN: process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN,
  }

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
    await ensureRbacCatalog(setup.module)
    service = setup.module.get(PlatformRoleBootstrapService)
  })

  afterAll(async () => {
    process.env.BACKOFFICE_AUTHORIZED_EMAILS = savedEnv.BACKOFFICE_AUTHORIZED_EMAILS
    process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = savedEnv.ORGANIZATION_CREATOR_EMAIL_DOMAIN
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    process.env.BACKOFFICE_AUTHORIZED_EMAILS = "admin@example.org"
    process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = "@example.org"
  })

  const saveUser = async (email: string): Promise<User> => {
    const repositories = setup.getAllRepositories()
    return repositories.userRepository.save(userFactory.build({ email }))
  }

  it("grants the roles promised by the configuration to a new user", async () => {
    const admin = await saveUser("admin@example.org")
    // A fresh service: the in-process cache of another test must not hide the query.
    const freshService = new PlatformRoleBootstrapService(setup.dataSource)

    await freshService.ensureGlobalRolesForUser(admin)

    expect(await service.listGlobalRoles(admin.id)).toEqual([
      PLATFORM_STAFF_ROLE,
      PLATFORM_SUPERADMIN_ROLE,
    ])
  })

  it("grants platform_staff only to a user of the domain", async () => {
    const staff = await saveUser("someone@example.org")

    await new PlatformRoleBootstrapService(setup.dataSource).ensureGlobalRolesForUser(staff)

    expect(await service.listGlobalRoles(staff.id)).toEqual([PLATFORM_STAFF_ROLE])
  })

  it("grants nothing to a user outside the configuration", async () => {
    const visitor = await saveUser("visitor@other.org")

    await new PlatformRoleBootstrapService(setup.dataSource).ensureGlobalRolesForUser(visitor)

    expect(await service.listGlobalRoles(visitor.id)).toEqual([])
  })

  it("is idempotent: a second sign-in does not duplicate the membership", async () => {
    const admin = await saveUser("admin@example.org")
    const freshService = new PlatformRoleBootstrapService(setup.dataSource)

    await freshService.ensureGlobalRolesForUser(admin)
    await new PlatformRoleBootstrapService(setup.dataSource).ensureGlobalRolesForUser(admin)

    const memberships = await setup.getAllRepositories().userMembershipRepository.find({
      where: { userId: admin.id, resourceType: "global" },
    })
    expect(memberships).toHaveLength(2)
  })

  it("grants and revokes a role by hand", async () => {
    const visitor = await saveUser("visitor@other.org")

    expect(await service.grantGlobalRole(visitor.id, PLATFORM_SUPERADMIN_ROLE)).toBe(true)
    expect(await service.grantGlobalRole(visitor.id, PLATFORM_SUPERADMIN_ROLE)).toBe(false)
    expect(await service.listGlobalRoles(visitor.id)).toEqual([PLATFORM_SUPERADMIN_ROLE])

    expect(await service.revokeGlobalRole(visitor.id, PLATFORM_SUPERADMIN_ROLE)).toBe(true)
    expect(await service.revokeGlobalRole(visitor.id, PLATFORM_SUPERADMIN_ROLE)).toBe(false)
    expect(await service.listGlobalRoles(visitor.id)).toEqual([])
  })
})
