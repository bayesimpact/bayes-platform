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
import { UserMembershipRepository } from "./user-membership.repository"

describe("UserMembershipRepository", () => {
  let repository: UserMembershipRepository
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [MembershipsModule, OrganizationsModule],
    })
    repositories = setup.getAllRepositories()
    repository = setup.module.get(UserMembershipRepository)
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

  describe("upsertMembership", () => {
    it("creates a new organization membership row", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      const anotherUser = await repositories.userRepository.save(userFactory.build())
      await repository.upsertMembership({
        userId: anotherUser.id,
        resourceType: "organization",
        resourceId: organization.id,
        role: "member",
      })

      const row = await getUserMembership(anotherUser.id, organization.id)
      expect(row).not.toBeNull()
      expect(row?.resourceType).toBe("organization")
      expect(row?.role).toBe("member")
      void user
    })

    it("updates the role when the membership already exists", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      await repository.upsertMembership({
        userId: user.id,
        resourceType: "organization",
        resourceId: organization.id,
        role: "member",
      })
      await repository.upsertMembership({
        userId: user.id,
        resourceType: "organization",
        resourceId: organization.id,
        role: "admin",
      })

      const row = await getUserMembership(user.id, organization.id)
      expect(row?.role).toBe("admin")
    })

    it("is idempotent when the role is unchanged", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      await repository.upsertMembership({
        userId: user.id,
        resourceType: "organization",
        resourceId: organization.id,
        role: "owner",
      })
      await repository.upsertMembership({
        userId: user.id,
        resourceType: "organization",
        resourceId: organization.id,
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
          await repository.upsertMembership(
            {
              userId: user.id,
              resourceType: "organization",
              resourceId: organization.id,
              role: "member",
            },
            manager,
          )
          throw new Error("forced rollback")
        }),
      ).rejects.toThrow("forced rollback")

      const row = await getUserMembership(user.id, organization.id)
      expect(row?.role).toBe("owner")
    })

    it("creates a project membership row", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      const projectId = "00000000-0000-0000-0000-000000000001"

      await repository.upsertMembership({
        userId: user.id,
        resourceType: "project",
        resourceId: projectId,
        role: "owner",
      })

      const row = await getUserMembership(user.id, projectId)
      expect(row?.resourceType).toBe("project")
      expect(row?.role).toBe("owner")
    })

    it("creates an agent membership row", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      const agentId = "00000000-0000-0000-0000-000000000002"

      await repository.upsertMembership({
        userId: user.id,
        resourceType: "agent",
        resourceId: agentId,
        role: "admin",
      })

      const row = await getUserMembership(user.id, agentId)
      expect(row?.resourceType).toBe("agent")
      expect(row?.role).toBe("admin")
    })

    it("allows the same user to hold both tester and reviewer roles on one campaign", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      const campaignId = "00000000-0000-0000-0000-000000000003"

      await repository.upsertMembership({
        userId: user.id,
        resourceType: "review_campaign",
        resourceId: campaignId,
        role: "tester",
      })
      await repository.upsertMembership({
        userId: user.id,
        resourceType: "review_campaign",
        resourceId: campaignId,
        role: "reviewer",
      })

      const rows = await setup.dataSource.getRepository(UserMembership).find({
        where: { userId: user.id, resourceId: campaignId, resourceType: "review_campaign" },
      })
      expect(rows).toHaveLength(2)
      const roles = rows.map((row) => row.role).sort()
      expect(roles).toEqual(["reviewer", "tester"])
    })

    it("is idempotent for the same review campaign role", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      const campaignId = "00000000-0000-0000-0000-000000000004"

      await repository.upsertMembership({
        userId: user.id,
        resourceType: "review_campaign",
        resourceId: campaignId,
        role: "tester",
      })
      await repository.upsertMembership({
        userId: user.id,
        resourceType: "review_campaign",
        resourceId: campaignId,
        role: "tester",
      })

      const rows = await setup.dataSource.getRepository(UserMembership).find({
        where: { userId: user.id, resourceId: campaignId, resourceType: "review_campaign" },
      })
      expect(rows).toHaveLength(1)
    })
  })

  describe("deleteMembership", () => {
    it("removes the row", async () => {
      const { organization, user } = await createOrganizationWithOwner(repositories)

      await repository.upsertMembership({
        userId: user.id,
        resourceType: "organization",
        resourceId: organization.id,
        role: "member",
      })
      await repository.deleteMembership({
        userId: user.id,
        resourceType: "organization",
        resourceId: organization.id,
      })

      const row = await getUserMembership(user.id, organization.id)
      expect(row).toBeNull()
    })
  })

  describe("deleteMembershipsForUser", () => {
    it("removes rows for multiple agents at once", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      const agentIds = [
        "00000000-0000-0000-0000-000000000010",
        "00000000-0000-0000-0000-000000000011",
      ]

      for (const agentId of agentIds) {
        await repository.upsertMembership({
          userId: user.id,
          resourceType: "agent",
          resourceId: agentId,
          role: "member",
        })
      }
      await repository.deleteMembershipsForUser({
        userId: user.id,
        resourceType: "agent",
        resourceIds: agentIds,
      })

      const rows = await setup.dataSource.getRepository(UserMembership).find({
        where: { userId: user.id, resourceType: "agent" },
      })
      expect(rows).toHaveLength(0)
    })

    it("is a no-op when resourceIds is empty", async () => {
      const { user } = await createOrganizationWithOwner(repositories)
      await expect(
        repository.deleteMembershipsForUser({
          userId: user.id,
          resourceType: "agent",
          resourceIds: [],
        }),
      ).resolves.not.toThrow()
    })
  })
})
