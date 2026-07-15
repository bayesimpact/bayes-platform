import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  ORG_CREATOR_ROLE,
  ORGANIZATION_CREATE_PERMISSION,
  ORGANIZATION_ROLES,
} from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { RbacService } from "@/domains/rbac/rbac.service"
import { Role } from "@/domains/rbac/role.entity"
import { userFactory } from "@/domains/users/user.factory"
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

    const adminUser = userFactory.build()
    await repositories.userRepository.save(adminUser)
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: adminUser.id,
        resourceType: "organization",
        resourceId: organization.id,
        role: "admin",
        roleId: (
          await repositories.roleRepository.findOneOrFail({
            where: { key: ORGANIZATION_ROLES.admin },
          })
        ).id,
      }),
    )

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
    const memberUser = userFactory.build()
    await repositories.userRepository.save(memberUser)
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: memberUser.id,
        resourceType: "organization",
        resourceId: organization.id,
        role: "member",
        roleId: (
          await repositories.roleRepository.findOneOrFail({
            where: { key: ORGANIZATION_ROLES.member },
          })
        ).id,
      }),
    )

    await expect(
      service.has(memberUser.id, "organization.update", {
        type: "organization",
        id: organization.id,
      }),
    ).resolves.toBe(false)
  })

  it("grants organization.create via global org_creator membership", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "creator@bayesimpact.org" })
    await repositories.userRepository.save(user)
    const orgCreatorRole = await repositories.roleRepository.findOneOrFail({
      where: { key: ORG_CREATOR_ROLE },
    })
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "global",
        resourceId: null,
        role: "member",
        roleId: orgCreatorRole.id,
      }),
    )

    await expect(service.hasGlobal(user.id, ORGANIZATION_CREATE_PERMISSION)).resolves.toBe(true)
  })

  it("denies organization.create without global org_creator membership", async () => {
    const repositories = setup.getAllRepositories()
    const user = userFactory.build({ email: "outsider@example.com" })
    await repositories.userRepository.save(user)

    await expect(service.hasGlobal(user.id, ORGANIZATION_CREATE_PERMISSION)).resolves.toBe(false)
  })
})

describe("RbacService", () => {
  let service: RbacService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = "@bayesimpact.org"
    setup = await setupE2eTestDatabase({ additionalImports: [RbacModule] })
    service = setup.module.get(RbacService)
    await service.seedOrganizationRolesAndPermissions()
  })

  afterAll(async () => {
    delete process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = "@bayesimpact.org"
    await clearTestDatabase(setup.dataSource)
  })

  it("seeds org roles and permissions idempotently", async () => {
    await service.seedOrganizationRolesAndPermissions()

    const roles = await setup.getRepository(Role).find()
    expect(roles.map((role) => role.key).sort()).toEqual(
      [...Object.values(ORGANIZATION_ROLES), ORG_CREATOR_ROLE].sort(),
    )
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

  it("assigns org_creator to eligible users", async () => {
    const repositories = setup.getAllRepositories()
    const eligibleUser = userFactory.build({ email: "member@bayesimpact.org" })
    const ineligibleUser = userFactory.build({ email: "member@example.com" })
    await repositories.userRepository.save([eligibleUser, ineligibleUser])

    const assignedCount = await service.assignOrgCreatorToEligibleUsers()
    expect(assignedCount).toBe(1)

    const orgCreatorRole = await setup.getRepository(Role).findOneOrFail({
      where: { key: ORG_CREATOR_ROLE },
    })
    const eligibleMembership = await setup.getRepository(UserMembership).findOne({
      where: {
        userId: eligibleUser.id,
        resourceType: "global",
        roleId: orgCreatorRole.id,
      },
    })
    const ineligibleMembership = await setup.getRepository(UserMembership).findOne({
      where: {
        userId: ineligibleUser.id,
        resourceType: "global",
        roleId: orgCreatorRole.id,
      },
    })

    expect(eligibleMembership).not.toBeNull()
    expect(eligibleMembership?.resourceId).toBeNull()
    expect(ineligibleMembership).toBeNull()
  })
})
