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
import { formAgentSessionFactory } from "@/domains/agents/form-agent-sessions/form-agent-session.factory"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
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
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-reviewer-list" }),
}

describe("ReviewCampaigns - Reviewer list sessions", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let accessToken: string = "token"
  let auth0Id = `auth0|reviewer-${randomUUID()}`

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
    auth0Id = `auth0|reviewer-${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const seedCampaignWithReviewer = async (campaignStatus: "active" | "closed" = "active") => {
    const {
      organization,
      project,
      user: reviewer,
    } = await createOrganizationWithProject(repositories, { user: { auth0Id } })
    const agent = agentFactory.transient({ organization, project }).build({ type: "conversation" })
    await repositories.agentRepository.save(agent)
    const factory =
      campaignStatus === "closed" ? reviewCampaignFactory.closed() : reviewCampaignFactory.active()
    const campaign = await repositories.reviewCampaignRepository.save(
      factory.transient({ organization, project, agent }).build(),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign, user: reviewer })
        .build(),
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, agent, campaign, reviewer }
  }

  const subject = async () =>
    request({
      route: ReviewCampaignsRoutes.listReviewerSessions,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })

  it("returns an empty list when no sessions exist", async () => {
    await seedCampaignWithReviewer()
    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.sessions).toEqual([])
  })

  it("lists both conversation and form sessions stamped with the campaign", async () => {
    const { organization, project, agent, campaign } = await seedCampaignWithReviewer()
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-list-${randomUUID()}@example.com` }),
    )
    const conversationSession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(conversationSession)
    const formAgent = agentFactory.transient({ organization, project }).build({ type: "form" })
    await repositories.agentRepository.save(formAgent)
    const formSession = formAgentSessionFactory
      .transient({ organization, project, agent: formAgent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.formAgentSessionRepository.save(formSession)

    const response = await subject()
    expectResponse(response, 200)
    const sessions = response.body.data.sessions
    expect(sessions).toHaveLength(2)
    expect(sessions.map((session) => session.agentType).sort()).toEqual(["conversation", "form"])
  })

  it("does not leak sessions from other campaigns", async () => {
    const { organization, project, agent, campaign } = await seedCampaignWithReviewer()
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-leak-${randomUUID()}@example.com` }),
    )
    const inScope = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(inScope)
    const otherCampaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.active().transient({ organization, project, agent }).build(),
    )
    const outOfScope = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: otherCampaign.id })
    await repositories.conversationAgentSessionRepository.save(outOfScope)

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.sessions).toHaveLength(1)
    expect(response.body.data.sessions[0]?.sessionId).toBe(inScope.id)
  })

  it("computes messageCount, reviewerCount, and callerHasReviewed", async () => {
    const { organization, project, agent, campaign, reviewer } = await seedCampaignWithReviewer()
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-counts-${randomUUID()}@example.com` }),
    )
    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session)
    // 3 messages for the session.
    for (let index = 0; index < 3; index += 1) {
      await repositories.agentMessageRepository.save({
        organizationId: organization.id,
        projectId: project.id,
        sessionId: session.id,
        role: "user",
        content: `hello ${index}`,
      })
    }
    // Another reviewer has already reviewed this session.
    const otherReviewer = await repositories.userRepository.save(
      userFactory.build({ email: `other-reviewer-${randomUUID()}@example.com` }),
    )
    await repositories.reviewerSessionReviewRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session.id,
      agentType: "conversation",
      reviewerUserId: otherReviewer.id,
      overallRating: 4,
      comment: null,
      answers: [],
      submittedAt: new Date(),
    })
    // Caller (reviewer) has also reviewed it.
    await repositories.reviewerSessionReviewRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session.id,
      agentType: "conversation",
      reviewerUserId: reviewer.id,
      overallRating: 5,
      comment: "mine",
      answers: [],
      submittedAt: new Date(),
    })

    const response = await subject()
    expectResponse(response, 200)
    const [row] = response.body.data.sessions
    expect(row?.messageCount).toBe(3)
    expect(row?.reviewerCount).toBe(2)
    expect(row?.callerHasReviewed).toBe(true)
    expect(row?.callerIsSessionOwner).toBe(false)
  })

  it("flags sessions owned by the caller (dual-role user)", async () => {
    const { organization, project, agent, campaign, reviewer } = await seedCampaignWithReviewer()
    const ownSession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: reviewer })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(ownSession)

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.sessions[0]?.callerIsSessionOwner).toBe(true)
  })

  it("still lists sessions on a closed campaign (reviewers keep read access)", async () => {
    const { organization, project, agent, campaign } = await seedCampaignWithReviewer("closed")
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-closed-${randomUUID()}@example.com` }),
    )
    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session)

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.sessions).toHaveLength(1)
  })
})
