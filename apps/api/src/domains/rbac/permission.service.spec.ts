import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { PermissionService } from "@/domains/rbac/permission.service"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { ensureOrganizationRbacCatalog } from "../../../test/rbac-test.helpers"

describe("PermissionService", () => {
  let service: PermissionService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
    await ensureOrganizationRbacCatalog(setup.module)
    service = setup.module.get(PermissionService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  it("grants organization.update to owners and admins", async () => {
    const repositories = setup.getAllRepositories()
    const { organization, user } = await createOrganizationWithOwner(repositories)

    await expect(
      service.has(user.id, "organization.update", {
        type: "organization",
        id: organization.id,
      }),
    ).resolves.toBe(true)

    const { user: adminUser } = await addUserToOrganization({
      repositories,
      organization,
      membership: { role: "admin" },
    })

    await expect(
      service.has(adminUser.id, "organization.update", {
        type: "organization",
        id: organization.id,
      }),
    ).resolves.toBe(true)
  })

  it("denies organization.update to members", async () => {
    const repositories = setup.getAllRepositories()
    const { organization } = await createOrganizationWithOwner(repositories)
    const { user: memberUser } = await addUserToOrganization({
      repositories,
      organization,
      membership: { role: "member" },
    })

    await expect(
      service.has(memberUser.id, "organization.update", {
        type: "organization",
        id: organization.id,
      }),
    ).resolves.toBe(false)
  })
})
