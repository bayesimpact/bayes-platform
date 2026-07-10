import { randomUUID } from "node:crypto"
import { ReviewCampaignsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "../memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "../review-campaign.factory"
import { ReviewCampaignsModule } from "../review-campaigns.module"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-list" }),
}

describe("ReviewCampaigns - list", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let accessToken: string = "token"
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider(INVITATION_SENDER)
          .useValue(mockInvitationSender),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async () =>
    request({
      route: ReviewCampaignsRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("lists campaigns scoped to the current project", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { auth0Id },
      },
    )
    await repositories.reviewCampaignRepository.save([
      reviewCampaignFactory
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "A" }),
      reviewCampaignFactory
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "B" }),
    ])
    organizationId = organization.id
    projectId = project.id

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.reviewCampaigns).toHaveLength(2)
    expect(response.body.data.reviewCampaigns.map((c) => c.name).sort()).toEqual(["A", "B"])
  })

  it("returns memberCount for each campaign (0 when no members)", async () => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { auth0Id },
      },
    )
    const [withMembers, empty] = await repositories.reviewCampaignRepository.save([
      reviewCampaignFactory
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "with-members" }),
      reviewCampaignFactory
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "empty" }),
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
    organizationId = organization.id
    projectId = project.id

    const response = await subject()
    expectResponse(response, 200)
    const byName = new Map(
      (response.body.data.reviewCampaigns as Array<{ name: string; memberCount: number }>).map(
        (campaign) => [campaign.name, campaign.memberCount],
      ),
    )
    expect(byName.get("with-members")).toBe(2)
    expect(byName.get("empty")).toBe(0)
  })

  it("does not leak campaigns from other projects", async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { auth0Id },
      },
    )
    await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "mine" }),
    )

    const {
      organization: otherOrg,
      project: otherProject,
      agent: otherAgent,
      agentSettings: otherAgentSettings,
    } = await createOrganizationWithAgent(repositories)
    await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .transient({
          organization: otherOrg,
          project: otherProject,
          agent: otherAgent,
          agentSettings: otherAgentSettings,
        })
        .build({ name: "other" }),
    )

    organizationId = organization.id
    projectId = project.id

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.reviewCampaigns).toHaveLength(1)
    expect(response.body.data.reviewCampaigns[0]?.name).toBe("mine")
  })
})
