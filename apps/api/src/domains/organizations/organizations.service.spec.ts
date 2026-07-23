import type { Repository } from "typeorm"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { ensureRbacCatalog } from "../../../test/rbac-test.helpers"
import { FeatureFlag } from "../feature-flags/feature-flag.entity"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "./memberships/organization-membership.factory"
import { Organization } from "./organization.entity"
import { createOrganizationWithOwner, organizationFactory } from "./organization.factory"
import { OrganizationsModule } from "./organizations.module"
import { OrganizationsService } from "./organizations.service"

describe("OrganizationsService", () => {
  let service: OrganizationsService
  let organizationRepository: Repository<Organization>
  let userMembershipRepository: Repository<UserMembership>
  let userRepository: Repository<User>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [OrganizationsModule],
    })
    await ensureRbacCatalog(setup.module)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get<OrganizationsService>(OrganizationsService)
    organizationRepository = setup.getRepository(Organization)
    userMembershipRepository = setup.getRepository(UserMembership)
    setup.getRepository(FeatureFlag)
    userRepository = setup.getRepository(User)
  })

  describe("createOrganization", () => {
    it("should create a new organization and membership with owner role", async () => {
      // Arrange
      const user = userFactory.build({
        email: "test@example.com",
      })
      const savedUser = await userRepository.save(user)

      // Act
      const result = await service.createOrganization({
        userId: savedUser.id,
        name: "Test Organization",
      })

      // Assert
      expect(result.name).toBe("Test Organization")
      expect(result.id).toBeDefined()
      expect(typeof result.createdAt).toBe("number")

      // Verify organization was saved
      const savedOrganization = await organizationRepository.findOne({
        where: { id: result.id },
      })
      expect(savedOrganization).not.toBeNull()
      expect(savedOrganization?.name).toBe("Test Organization")

      // Verify membership was created with owner role
      const membership = await userMembershipRepository.findOne({
        where: {
          userId: savedUser.id,
          resourceId: result.id,
          resourceType: "organization",
        },
      })
      expect(membership).not.toBeNull()
      expect(membership?.role).toBe("owner")
    })

    it("should create organization with correct user membership relationship", async () => {
      // Arrange
      const user = userFactory.build({
        email: "user@example.com",
      })
      const savedUser = await userRepository.save(user)

      // Act
      const organization = await service.createOrganization({
        userId: savedUser.id,
        name: "My Org",
      })

      // Assert - Verify the membership links user and organization correctly
      const membership = await userMembershipRepository.findOne({
        where: {
          userId: savedUser.id,
          resourceId: organization.id,
          resourceType: "organization",
        },
      })
      expect(membership).not.toBeNull()
      expect(membership?.userId).toBe(savedUser.id)
      expect(membership?.resourceId).toBe(organization.id)
    })

    it("should allow multiple organizations to be created", async () => {
      // Arrange
      const user = userFactory.build({
        email: "multi@example.com",
      })
      const savedUser = await userRepository.save(user)

      // Act
      const result1 = await service.createOrganization({
        userId: savedUser.id,
        name: "Org 1",
      })
      const result2 = await service.createOrganization({
        userId: savedUser.id,
        name: "Org 2",
      })

      // Assert
      expect(result1.name).toBe("Org 1")
      expect(result2.name).toBe("Org 2")
      expect(result1.id).not.toBe(result2.id)

      // Verify both memberships exist
      const memberships = await userMembershipRepository.find({
        where: { userId: savedUser.id, resourceType: "organization" },
      })
      expect(memberships).toHaveLength(2)
      expect(memberships.every((membership) => membership.role === "owner")).toBe(true)
    })

    it("should create organization with unique IDs", async () => {
      // Arrange
      const user = userFactory.build({
        email: "unique@example.com",
      })
      const savedUser = await userRepository.save(user)

      // Act
      const result1 = await service.createOrganization({
        userId: savedUser.id,
        name: "Unique Org 1",
      })
      const result2 = await service.createOrganization({
        userId: savedUser.id,
        name: "Unique Org 2",
      })

      // Assert
      expect(result1.id).not.toBe(result2.id)
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
    })

    it("should create organization with timestamps", async () => {
      // Arrange
      const user = userFactory.build({
        email: "timestamp@example.com",
      })
      const savedUser = await userRepository.save(user)

      // Act
      const organization = await service.createOrganization({
        userId: savedUser.id,
        name: "Timestamp Org",
      })

      // Assert
      expect(typeof organization.createdAt).toBe("number")
      expect(organization.createdAt).toBeLessThanOrEqual(Date.now())
    })
  })

  describe("listOrganizations", () => {
    it("returns an empty array when user has no organizations", async () => {
      // Arrange
      const user = userFactory.build({
        email: "noorgs@example.com",
      })
      const savedUser = await userRepository.save(user)

      // Act
      const result = await service.listOrganizations(savedUser.id)

      // Assert
      expect(result).toEqual([])
    })

    it("returns organizations with permissions", async () => {
      const repositories = setup.getAllRepositories()
      const { user, organization } = await createOrganizationWithOwner(repositories)

      const result = await service.listOrganizations(user.id)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: organization.id,
        name: organization.name,
        createdAt: expect.any(Number),
        permissions: expect.arrayContaining([
          "organization.read",
          "organization.update",
          "project.create",
          "project.read",
        ]),
      })
    })

    it("returns every organization the user is a member of", async () => {
      const repositories = setup.getAllRepositories()
      const { user, organization: ownedOrganization } =
        await createOrganizationWithOwner(repositories)

      const joinedOrganization = await organizationRepository.save(
        organizationFactory.build({ name: "Joined Org" }),
      )
      await saveOrgMembership({
        repositories,
        membership: organizationMembershipFactory
          .transient({ user, organization: joinedOrganization })
          .build({ role: "member" }),
      })

      const result = await service.listOrganizations(user.id)

      expect(result.map((organization) => organization.id).sort()).toEqual(
        [ownedOrganization.id, joinedOrganization.id].sort(),
      )
    })
  })
})
