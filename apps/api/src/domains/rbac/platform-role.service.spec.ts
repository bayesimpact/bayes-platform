import type { PlatformRoleRepository } from "@/domains/rbac/platform-role.repository"
import { isPlatformRoleKey, PlatformRoleService } from "@/domains/rbac/platform-role.service"
import { PLATFORM_STAFF_ROLE, PLATFORM_SUPERADMIN_ROLE } from "@/domains/rbac/rbac.constants"

describe("isPlatformRoleKey", () => {
  it("accepts the two global roles only", () => {
    expect(isPlatformRoleKey("platform_staff")).toBe(true)
    expect(isPlatformRoleKey("platform_superadmin")).toBe(true)
    expect(isPlatformRoleKey("org_owner")).toBe(false)
  })
})

describe("PlatformRoleService", () => {
  const repository = {
    grantGlobalRole: jest.fn(),
    revokeGlobalRole: jest.fn(),
    listGlobalRoleKeys: jest.fn(),
  }
  const service = new PlatformRoleService(repository as unknown as PlatformRoleRepository)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("delegates the grant to the repository", async () => {
    repository.grantGlobalRole.mockResolvedValue(true)
    await expect(service.grantGlobalRole("user-1", PLATFORM_SUPERADMIN_ROLE)).resolves.toBe(true)
    expect(repository.grantGlobalRole).toHaveBeenCalledWith("user-1", PLATFORM_SUPERADMIN_ROLE)
  })

  it("delegates the revoke to the repository", async () => {
    repository.revokeGlobalRole.mockResolvedValue(false)
    await expect(service.revokeGlobalRole("user-1", PLATFORM_STAFF_ROLE)).resolves.toBe(false)
    expect(repository.revokeGlobalRole).toHaveBeenCalledWith("user-1", PLATFORM_STAFF_ROLE)
  })

  it("lists the roles from the repository", async () => {
    repository.listGlobalRoleKeys.mockResolvedValue([PLATFORM_STAFF_ROLE])
    await expect(service.listGlobalRoles("user-1")).resolves.toEqual([PLATFORM_STAFF_ROLE])
    expect(repository.listGlobalRoleKeys).toHaveBeenCalledWith("user-1")
  })
})
