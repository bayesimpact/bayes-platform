import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import {
  createOrganizationWithOwner,
  organizationFactory,
} from "@/domains/organizations/organization.factory"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ORGANIZATION_ROLES } from "@/domains/rbac/rbac.constants"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { ensureOrganizationRbacCatalog } from "../../../../test/rbac-test.helpers"

describe("OrganizationMembershipsService", () => {
  let service: OrganizationMembershipsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [OrganizationsModule, RbacModule],
    })
    await ensureOrganizationRbacCatalog(setup.module)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<OrganizationMembershipsService>(OrganizationMembershipsService)
    repositories = setup.getAllRepositories()
  })

  describe("findOrganizationMembership", () => {
    it("should return membership when user is a member of the organization", async () => {
      const { user, organization } = await createOrganizationWithOwner(repositories)

      const result = await service.findOrganizationMembership({
        userId: user.id,
        organizationId: organization.id,
      })

      expect(result).not.toBeNull()
      expect(result?.userId).toBe(user.id)
      expect(result?.organizationId).toBe(organization.id)
      expect(result?.role).toBeDefined()
    })

    it("should return null when user is not a member of the organization", async () => {
      const { user } = await createOrganizationWithOwner(repositories, {
        user: { email: "nonmember@example.com" },
      })

      const { organization } = await createOrganizationWithOwner(repositories, {
        organization: { name: "Other Org" },
      })

      const result = await service.findOrganizationMembership({
        userId: user.id,
        organizationId: organization.id,
      })

      expect(result).toBeNull()
    })

    it("should return null when organization does not exist", async () => {
      const { user } = await createOrganizationWithOwner(repositories, {
        user: { email: "user@example.com" },
      })

      const nonExistentOrganizationId = "00000000-0000-0000-0000-000000000000"

      const result = await service.findOrganizationMembership({
        userId: user.id,
        organizationId: nonExistentOrganizationId,
      })

      expect(result).toBeNull()
    })

    it("should return null when user does not exist", async () => {
      const { organization } = await createOrganizationWithOwner(repositories)

      const nonExistentUserId = "00000000-0000-0000-0000-000000000000"

      const result = await service.findOrganizationMembership({
        userId: nonExistentUserId,
        organizationId: organization.id,
      })

      expect(result).toBeNull()
    })

    it("should return the correct membership when user has multiple memberships", async () => {
      const { user, organization: organization1 } = await createOrganizationWithOwner(
        repositories,
        {
          user: { email: "multimember@example.com" },
          organization: { name: "Org 1" },
          organizationMembership: { role: "owner" },
        },
      )

      const savedOrganization2 = await repositories.organizationRepository.save(
        organizationFactory.build({ name: "Org 2" }),
      )
      await saveOrgMembership({
        repositories,
        membership: organizationMembershipFactory
          .transient({ user, organization: savedOrganization2 })
          .member()
          .build(),
      })

      const result1 = await service.findOrganizationMembership({
        userId: user.id,
        organizationId: organization1.id,
      })
      const result2 = await service.findOrganizationMembership({
        userId: user.id,
        organizationId: savedOrganization2.id,
      })

      expect(result1).not.toBeNull()
      expect(result1?.organizationId).toBe(organization1.id)
      expect(result1?.role).toBe("owner")

      expect(result2).not.toBeNull()
      expect(result2?.organizationId).toBe(savedOrganization2.id)
      expect(result2?.role).toBe("member")
    })
  })

  describe("upsertOrganizationAdminMembership", () => {
    it("creates an admin organization membership when none exists", async () => {
      const { user, organization } = await createOrganizationWithOwner(repositories)
      await repositories.userMembershipRepository.delete({ userId: user.id })

      await service.upsertOrganizationAdminMembership({
        userId: user.id,
        organizationId: organization.id,
      })

      const membership = await repositories.userMembershipRepository.findOne({
        where: {
          userId: user.id,
          resourceId: organization.id,
          resourceType: "organization",
        },
      })
      expect(membership?.role).toBe("admin")
      const orgAdminRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.admin },
      })
      expect(membership?.roleId).toBe(orgAdminRole.id)
    })

    it("promotes a member to admin", async () => {
      const { user, organization } = await createOrganizationWithOwner(repositories, {
        organizationMembership: { role: "member" },
      })

      await service.upsertOrganizationAdminMembership({
        userId: user.id,
        organizationId: organization.id,
      })

      const membership = await repositories.userMembershipRepository.findOneOrFail({
        where: {
          userId: user.id,
          resourceId: organization.id,
          resourceType: "organization",
        },
      })
      expect(membership.role).toBe("admin")
      const orgAdminRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.admin },
      })
      expect(membership.roleId).toBe(orgAdminRole.id)
    })

    it("is a no-op when the user is already admin or owner", async () => {
      const { user, organization } = await createOrganizationWithOwner(repositories)

      await service.upsertOrganizationAdminMembership({
        userId: user.id,
        organizationId: organization.id,
      })

      const membership = await repositories.userMembershipRepository.findOneOrFail({
        where: {
          userId: user.id,
          resourceId: organization.id,
          resourceType: "organization",
        },
      })
      expect(membership.role).toBe("owner")
    })
  })

  describe("createOrganizationOwnerMembership", () => {
    it("writes owner membership to user_membership", async () => {
      const { user, organization } = await createOrganizationWithOwner(repositories)
      await repositories.userMembershipRepository.delete({ userId: user.id })

      await service.createOrganizationOwnerMembership({
        userId: user.id,
        organizationId: organization.id,
      })

      const userMembership = await setup.dataSource.getRepository(UserMembership).findOneOrFail({
        where: {
          userId: user.id,
          resourceId: organization.id,
          resourceType: "organization",
        },
      })
      expect(userMembership.role).toBe("owner")
      const orgOwnerRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.owner },
      })
      expect(userMembership.roleId).toBe(orgOwnerRole.id)
    })
  })

  describe("upsertOrganizationMemberMembership", () => {
    it("creates a member organization membership with role_id", async () => {
      const { user, organization } = await createOrganizationWithOwner(repositories)
      await repositories.userMembershipRepository.delete({ userId: user.id })

      await service.upsertOrganizationMemberMembership({
        userId: user.id,
        organizationId: organization.id,
      })

      const membership = await repositories.userMembershipRepository.findOneOrFail({
        where: {
          userId: user.id,
          resourceId: organization.id,
          resourceType: "organization",
        },
      })
      expect(membership.role).toBe("member")
      const orgMemberRole = await repositories.roleRepository.findOneOrFail({
        where: { key: ORGANIZATION_ROLES.member },
      })
      expect(membership.roleId).toBe(orgMemberRole.id)
    })
  })
})
