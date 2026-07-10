import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { reviewCampaignFactory } from "../review-campaign.factory"
import { ReviewCampaignMembershipRepository } from "./review-campaign-membership.repository"
import { ReviewCampaignMembershipsService } from "./review-campaign-memberships.service"

describe("ReviewCampaignMembershipsService", () => {
  let service: ReviewCampaignMembershipsService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [MembershipsModule],
      providers: [ReviewCampaignMembershipRepository, ReviewCampaignMembershipsService],
    })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    service = setup.module.get(ReviewCampaignMembershipsService)
    repositories = setup.getAllRepositories()
  })

  const saveActiveCampaign = async (
    organization: Awaited<ReturnType<typeof createOrganizationWithProject>>["organization"],
    project: Awaited<ReturnType<typeof createOrganizationWithProject>>["project"],
  ) => {
    const agent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build(),
    )
    const agentSettings = await repositories.agentSettingsRepository.save(
      agentSettingsFactory.transient({ organization, project, agent }).build(),
    )
    return repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
  }

  describe("acceptCampaignMembership", () => {
    it("creates a unified user_membership row for a new membership", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)
      const campaign = await saveActiveCampaign(organization, project)

      await service.acceptCampaignMembership({
        campaignId: campaign.id,
        userId: user.id,
        role: "tester",
        organizationId: organization.id,
        projectId: project.id,
      })

      const unified = await repositories.userMembershipRepository.findOne({
        where: {
          userId: user.id,
          resourceId: campaign.id,
          resourceType: "review_campaign",
          role: "tester",
        },
      })
      expect(unified).not.toBeNull()
    })

    it("allows tester and reviewer roles on the same campaign", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)
      const campaign = await saveActiveCampaign(organization, project)

      await service.acceptCampaignMembership({
        campaignId: campaign.id,
        userId: user.id,
        role: "tester",
        organizationId: organization.id,
        projectId: project.id,
      })
      await service.acceptCampaignMembership({
        campaignId: campaign.id,
        userId: user.id,
        role: "reviewer",
        organizationId: organization.id,
        projectId: project.id,
      })

      const unified = await setup.dataSource.getRepository(UserMembership).find({
        where: {
          userId: user.id,
          resourceId: campaign.id,
          resourceType: "review_campaign",
        },
      })
      expect(unified).toHaveLength(2)
    })
  })

  describe("removeCampaignMembership", () => {
    it("deletes only the targeted role from user_membership", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)
      const campaign = await saveActiveCampaign(organization, project)

      await service.acceptCampaignMembership({
        campaignId: campaign.id,
        userId: user.id,
        role: "tester",
        organizationId: organization.id,
        projectId: project.id,
      })
      await service.acceptCampaignMembership({
        campaignId: campaign.id,
        userId: user.id,
        role: "reviewer",
        organizationId: organization.id,
        projectId: project.id,
      })

      const testerMembership = await service.findByUserCampaignAndRole({
        campaignId: campaign.id,
        userId: user.id,
        role: "tester",
      })
      expect(testerMembership).not.toBeNull()

      await service.removeCampaignMembership({
        membershipId: testerMembership!.id,
        campaignId: campaign.id,
        userId: user.id,
        role: "tester",
      })

      const remainingUnified = await setup.dataSource.getRepository(UserMembership).find({
        where: {
          userId: user.id,
          resourceId: campaign.id,
          resourceType: "review_campaign",
        },
      })
      expect(remainingUnified).toHaveLength(1)
      expect(remainingUnified[0]?.role).toBe("reviewer")
    })
  })
})
