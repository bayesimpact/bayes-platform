import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "./memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "./review-campaign.factory"
import { ReviewCampaignRepository } from "./review-campaign.repository"

describe("ReviewCampaignRepository", () => {
  let repository: ReviewCampaignRepository
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [MembershipsModule],
      providers: [ReviewCampaignRepository],
    })
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    repository = setup.module.get(ReviewCampaignRepository)
    repositories = setup.getAllRepositories()
  })

  describe("listWithMemberCounts", () => {
    it("returns campaigns scoped to the project with member counts in one query", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories)
      const agent = await repositories.agentRepository.save(
        agentFactory.transient({ organization, project }).build(),
      )
      const [withMembers, empty] = await repositories.reviewCampaignRepository.save([
        reviewCampaignFactory
          .transient({ organization, project, agent })
          .build({ name: "with-members" }),
        reviewCampaignFactory.transient({ organization, project, agent }).build({ name: "empty" }),
      ])
      if (!withMembers || !empty) throw new Error("factory returned empty")

      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .tester()
          .transient({ organization, project, campaign: withMembers, user })
          .build(),
      })
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .reviewer()
          .transient({ organization, project, campaign: withMembers, user })
          .build(),
      })

      const results = await repository.listWithMemberCounts({
        organizationId: organization.id,
        projectId: project.id,
      })

      const byName = new Map(results.map((result) => [result.campaign.name, result.memberCount]))
      expect(results).toHaveLength(2)
      expect(byName.get("with-members")).toBe(2)
      expect(byName.get("empty")).toBe(0)
    })
  })
})
