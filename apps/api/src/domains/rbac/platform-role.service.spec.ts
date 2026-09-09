import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { isPlatformRoleKey, PlatformRoleService } from "@/domains/rbac/platform-role.service"
import { PLATFORM_STAFF_ROLE, PLATFORM_SUPERADMIN_ROLE } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"

describe("isPlatformRoleKey", () => {
  it("accepts the two global roles only", () => {
    expect(isPlatformRoleKey("platform_staff")).toBe(true)
    expect(isPlatformRoleKey("platform_superadmin")).toBe(true)
    expect(isPlatformRoleKey("org_owner")).toBe(false)
  })
})

describe("PlatformRoleService", () => {
  let service: PlatformRoleService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
    await ensureRbacCatalog(setup.module)
    service = setup.module.get(PlatformRoleService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  const saveUser = async (email: string): Promise<User> => {
    const repositories = setup.getAllRepositories()
    return repositories.userRepository.save(userFactory.build({ email }))
  }

  it("grants a role once", async () => {
    const admin = await saveUser("admin@example.org")

    expect(await service.grantGlobalRole(admin.id, PLATFORM_SUPERADMIN_ROLE)).toBe(true)
    expect(await service.grantGlobalRole(admin.id, PLATFORM_SUPERADMIN_ROLE)).toBe(false)

    const memberships = await setup.getAllRepositories().userMembershipRepository.find({
      where: { userId: admin.id, resourceType: "global" },
    })
    expect(memberships).toHaveLength(1)
    expect(await service.listGlobalRoles(admin.id)).toEqual([PLATFORM_SUPERADMIN_ROLE])
  })

  it("lists every global role of a user, sorted", async () => {
    const admin = await saveUser("admin@example.org")
    await service.grantGlobalRole(admin.id, PLATFORM_SUPERADMIN_ROLE)
    await service.grantGlobalRole(admin.id, PLATFORM_STAFF_ROLE)

    expect(await service.listGlobalRoles(admin.id)).toEqual([
      PLATFORM_STAFF_ROLE,
      PLATFORM_SUPERADMIN_ROLE,
    ])
  })

  it("revokes a role once and can grant it again", async () => {
    const staff = await saveUser("staff@example.org")
    await service.grantGlobalRole(staff.id, PLATFORM_STAFF_ROLE)

    expect(await service.revokeGlobalRole(staff.id, PLATFORM_STAFF_ROLE)).toBe(true)
    expect(await service.revokeGlobalRole(staff.id, PLATFORM_STAFF_ROLE)).toBe(false)
    expect(await service.listGlobalRoles(staff.id)).toEqual([])

    expect(await service.grantGlobalRole(staff.id, PLATFORM_STAFF_ROLE)).toBe(true)
    expect(await service.listGlobalRoles(staff.id)).toEqual([PLATFORM_STAFF_ROLE])
  })

  it("does nothing for a user without roles", async () => {
    const visitor = await saveUser("visitor@other.org")

    expect(await service.revokeGlobalRole(visitor.id, PLATFORM_STAFF_ROLE)).toBe(false)
    expect(await service.listGlobalRoles(visitor.id)).toEqual([])
  })
})
