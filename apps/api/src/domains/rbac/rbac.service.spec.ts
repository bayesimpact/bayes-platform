import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { RbacService } from "@/domains/rbac/rbac.service"
import { Role } from "@/domains/rbac/role.entity"

describe("RbacService", () => {
  let service: RbacService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
    service = setup.module.get(RbacService)
    await service.seedOrganizationRolesAndPermissions()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  it("seeds org roles and permissions idempotently", async () => {
    await service.seedOrganizationRolesAndPermissions()

    const roles = await setup.getRepository(Role).find()
    expect(roles.map((role) => role.key).sort()).toEqual(Object.values(ORGANIZATION_ROLES).sort())
  })

  it("assigns role_id on organization memberships", async () => {
    const repositories = setup.getAllRepositories()
    const { user, organization } = await createOrganizationWithOwner(repositories)

    await service.assignRoleIdsToOrganizationMemberships()

    const membership = await setup.getRepository(UserMembership).findOneOrFail({
      where: { userId: user.id, resourceId: organization.id, resourceType: "organization" },
    })
    const orgOwnerRole = await setup.getRepository(Role).findOneOrFail({
      where: { key: ORGANIZATION_ROLES.owner },
    })
    expect(membership.roleId).toBe(orgOwnerRole.id)
  })
})
