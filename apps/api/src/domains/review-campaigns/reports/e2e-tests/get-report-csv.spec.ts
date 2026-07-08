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
import { agentFactory } from "@/domains/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "../../memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "../../review-campaign.factory"
import { ReviewCampaignsModule } from "../../review-campaigns.module"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-report-csv" }),
}

describe("ReviewCampaigns - Report CSV", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let accessToken: string | null = "token"
  let auth0Id = `auth0|csv-${randomUUID()}`

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
    auth0Id = `auth0|csv-${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const seedCampaignWithSession = async () => {
    const {
      organization,
      project,
      user: owner,
    } = await createOrganizationWithProject(repositories, { user: { auth0Id } })
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-csv-${randomUUID()}@example.com` }),
    )
    const reviewer = await repositories.userRepository.save(
      userFactory.build({ email: `reviewer-csv-${randomUUID()}@example.com` }),
    )
    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory.transient({ user: reviewer, organization }).build(),
    })

    const agent = agentFactory.transient({ organization, project }).build({ type: "conversation" })
    await repositories.agentRepository.save(agent)

    const agentSettings = agentSettingsFactory
      .transient({ organization, project, agent: agent })
      .build()
    await repositories.agentSettingsRepository.save(agentSettings)

    const campaign = reviewCampaignFactory
      .active()
      .transient({ organization, project, agent, agentSettings })
      .build({})
    await repositories.reviewCampaignRepository.save(campaign)
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign, user: reviewer })
        .build(),
    })

    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session)

    await repositories.testerSessionFeedbackRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session.id,
      agentType: "conversation",
      overallRating: 4,
      comment: null,
      answers: [],
    })
    await repositories.reviewerSessionReviewRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session.id,
      agentType: "conversation",
      reviewerUserId: reviewer.id,
      overallRating: 3,
      comment: null,
      answers: [],
      submittedAt: new Date(),
    })

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    return { organization, project, owner, tester, reviewer, session, campaign }
  }

  const subject = async () =>
    request({
      route: ReviewCampaignsRoutes.getCampaignReportCsv,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken ?? undefined,
    })

  it("returns text/csv with header row and one row per session", async () => {
    const { session } = await seedCampaignWithSession()
    const response = await subject()
    expectResponse(response, 200)
    expect(response.headers["content-type"]).toContain("text/csv")
    expect(response.headers["content-disposition"]).toContain("attachment")

    const body = response.text
    const lines = body.split("\r\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(
      "sessionId,agentType,testerUserId,startedAt,testerRating,reviewerCount,meanReviewerRating,reviewerRatingSpread,reviewerRatings",
    )
    expect(lines[1]).toContain(session.id)
    expect(lines[1]).toContain("conversation")
    // testerRating=4, reviewerCount=1, meanReviewer=3, spread="" (only one reviewer)
    expect(lines[1]).toMatch(/,4,1,3,,3$/)
  })

  it("returns just the header when there are no sessions", async () => {
    await createOrganizationWithAgent(repositories, {
      user: { auth0Id },
      agent: { type: "conversation" },
    }).then(async ({ organization, project, agent, agentSettings }) => {
      const campaign = reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build({})
      await repositories.reviewCampaignRepository.save(campaign)
      organizationId = organization.id
      projectId = project.id
      reviewCampaignId = campaign.id
    })

    const response = await subject()
    expectResponse(response, 200)
    expect(response.text).toBe(
      "sessionId,agentType,testerUserId,startedAt,testerRating,reviewerCount,meanReviewerRating,reviewerRatingSpread,reviewerRatings",
    )
  })

  it("allows an accepted reviewer to download the CSV", async () => {
    const { reviewer } = await seedCampaignWithSession()
    auth0Id = reviewer.auth0Id

    const response = await subject()
    expectResponse(response, 200)
    expect(response.headers["content-type"]).toContain("text/csv")
  })

  it("rejects callers who aren't org members (401)", async () => {
    await seedCampaignWithSession()
    const outsider = await repositories.userRepository.save(
      userFactory.build({ email: `outsider-csv-${randomUUID()}@example.com` }),
    )
    auth0Id = outsider.auth0Id

    const response = await subject()
    expectResponse(response, 401)
  })

  it("requires an authentication token (401)", async () => {
    await seedCampaignWithSession()
    accessToken = null
    const response = await subject()
    expectResponse(response, 401)
  })
})
