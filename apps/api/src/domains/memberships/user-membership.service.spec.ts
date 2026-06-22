import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { userFactory } from "@/domains/users/user.factory"
import { MembershipsModule } from "./memberships.module"
import { UserMembership } from "./user-membership.entity"
import { UserMembershipService } from "./user-membership.service"

describe("UserMembershipService", () => {
  let service: UserMembershipService
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [MembershipsModule, OrganizationsModule],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(UserMembershipService)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  const getUserMembership = (userId: string, resourceId: string) =>
    setup.dataSource.getRepository(UserMembership).findOne({
      where: { userId, resourceId },
    })

  describe("upsertOrganizationMembership", () => {
    it("creates a new organization membership row", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      const anotherUser = await repositories.userRepository.save(userFactory.build())
      await service.upsertOrganizationMembership({
        userId: anotherUser.id,
        organizationId: organization.id,
        role: "member",
      })

      const row = await getUserMembership(anotherUser.id, organization.id)
      expect(row).not.toBeNull()
      expect(row?.resourceType).toBe("organization")
      expect(row?.role).toBe("member")
      // suppress unused variable warning
      void user
    })

    it("updates the role when the membership already exists", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      await service.upsertOrganizationMembership({
        userId: user.id,
        organizationId: organization.id,
        role: "member",
      })
      await service.upsertOrganizationMembership({
        userId: user.id,
        organizationId: organization.id,
        role: "admin",
      })

      const row = await getUserMembership(user.id, organization.id)
      expect(row?.role).toBe("admin")
    })

    it("is idempotent when the role is unchanged", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      await service.upsertOrganizationMembership({
        userId: user.id,
        organizationId: organization.id,
        role: "owner",
      })
      await service.upsertOrganizationMembership({
        userId: user.id,
        organizationId: organization.id,
        role: "owner",
      })

      const rows = await setup.dataSource.getRepository(UserMembership).find({
        where: { userId: user.id, resourceId: organization.id, resourceType: "organization" },
      })
      expect(rows).toHaveLength(1)
    })

    it("participates in a caller-supplied transaction", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      await expect(
        setup.dataSource.transaction(async (manager) => {
          await service.upsertOrganizationMembership(
            { userId: user.id, organizationId: organization.id, role: "member" },
            manager,
          )
          throw new Error("forced rollback")
        }),
      ).rejects.toThrow("forced rollback")

      const row = await getUserMembership(user.id, organization.id)
      expect(row).toBeNull()
    })
  })

  describe("upsertProjectMembership", () => {
    it("creates a project membership row", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)
      const projectId = "00000000-0000-0000-0000-000000000001"

      await service.upsertProjectMembership({ userId: user.id, projectId, role: "owner" })

      const row = await getUserMembership(user.id, projectId)
      expect(row?.resourceType).toBe("project")
      expect(row?.role).toBe("owner")
      void organization
    })
  })

  describe("upsertAgentMembership", () => {
    it("creates an agent membership row", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      const agentId = "00000000-0000-0000-0000-000000000002"

      await service.upsertAgentMembership({ userId: user.id, agentId, role: "admin" })

      const row = await getUserMembership(user.id, agentId)
      expect(row?.resourceType).toBe("agent")
      expect(row?.role).toBe("admin")
    })
  })

  describe("upsertReviewCampaignMembership", () => {
    it("allows the same user to hold both tester and reviewer roles on one campaign", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      const campaignId = "00000000-0000-0000-0000-000000000003"

      await service.upsertReviewCampaignMembership({ userId: user.id, campaignId, role: "tester" })
      await service.upsertReviewCampaignMembership({
        userId: user.id,
        campaignId,
        role: "reviewer",
      })

      const rows = await setup.dataSource.getRepository(UserMembership).find({
        where: { userId: user.id, resourceId: campaignId, resourceType: "review_campaign" },
      })
      expect(rows).toHaveLength(2)
      const roles = rows.map((row) => row.role).sort()
      expect(roles).toEqual(["reviewer", "tester"])
    })

    it("is idempotent for the same role", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      const campaignId = "00000000-0000-0000-0000-000000000004"

      await service.upsertReviewCampaignMembership({ userId: user.id, campaignId, role: "tester" })
      await service.upsertReviewCampaignMembership({ userId: user.id, campaignId, role: "tester" })

      const rows = await setup.dataSource.getRepository(UserMembership).find({
        where: { userId: user.id, resourceId: campaignId, resourceType: "review_campaign" },
      })
      expect(rows).toHaveLength(1)
    })
  })

  describe("deleteOrganizationMembership", () => {
    it("removes the row", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      await service.upsertOrganizationMembership({
        userId: user.id,
        organizationId: organization.id,
        role: "member",
      })
      await service.deleteOrganizationMembership({
        userId: user.id,
        organizationId: organization.id,
      })

      const row = await getUserMembership(user.id, organization.id)
      expect(row).toBeNull()
    })
  })

  describe("deleteAgentMembershipsForUser", () => {
    it("removes rows for multiple agents at once", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      const agentIds = [
        "00000000-0000-0000-0000-000000000010",
        "00000000-0000-0000-0000-000000000011",
      ]

      for (const agentId of agentIds) {
        await service.upsertAgentMembership({ userId: user.id, agentId, role: "member" })
      }
      await service.deleteAgentMembershipsForUser({ userId: user.id, agentIds })

      const rows = await setup.dataSource.getRepository(UserMembership).find({
        where: { userId: user.id, resourceType: "agent" },
      })
      expect(rows).toHaveLength(0)
    })

    it("is a no-op when agentIds is empty", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      await expect(
        service.deleteAgentMembershipsForUser({ userId: user.id, agentIds: [] }),
      ).resolves.not.toThrow()
    })
  })
})
