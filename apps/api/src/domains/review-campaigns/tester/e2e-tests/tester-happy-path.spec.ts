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
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { reviewCampaignMembershipFactory } from "../../memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "../../review-campaign.factory"
import { ReviewCampaignsModule } from "../../review-campaigns.module"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-tester" }),
}

describe("ReviewCampaigns - Tester happy path", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
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

  const seedActiveCampaignWithTester = async (
    agentType: "conversation" | "form" = "conversation",
  ) => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    const agent = agentFactory.transient({ organization, project }).build({ type: agentType })
    await repositories.agentRepository.save(agent)
    const campaign = reviewCampaignFactory
      .active()
      .transient({ organization, project, agent })
      .build({
        testerPerSessionQuestions: [
          { id: "q1", prompt: "Was it clear?", type: "rating", required: true },
        ],
        testerEndOfPhaseQuestions: [
          { id: "s1", prompt: "Would you recommend?", type: "rating", required: false },
        ],
      })
    await repositories.reviewCampaignRepository.save(campaign)
    const membership = reviewCampaignMembershipFactory
      .tester()
      .accepted()
      .transient({ organization, project, campaign, user })
      .build()
    await repositories.reviewCampaignMembershipRepository.save(membership)

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    return { organization, project, user, agent, campaign }
  }

  it("getTesterContext returns campaign + agent snapshot + questions", async () => {
    const { agent, campaign } = await seedActiveCampaignWithTester()

    const response = await request({
      route: ReviewCampaignsRoutes.getTesterContext,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })
    expectResponse(response, 200)
    expect(response.body.data).toMatchObject({
      id: campaign.id,
      name: campaign.name,
      status: "active",
      agent: { id: agent.id, name: agent.name, type: "conversation" },
      testerPerSessionQuestions: campaign.testerPerSessionQuestions,
      testerEndOfPhaseQuestions: campaign.testerEndOfPhaseQuestions,
    })
  })

  it("getMyReviewCampaigns lists active campaigns the user testers on", async () => {
    await seedActiveCampaignWithTester()
    const response = await request({
      route: ReviewCampaignsRoutes.getMyReviewCampaigns,
      token: accessToken,
    })
    expectResponse(response, 200)
    expect(response.body.data.reviewCampaigns).toHaveLength(1)
    expect(response.body.data.reviewCampaigns[0]?.id).toBe(reviewCampaignId)
  })

  it("getMyReviewCampaigns filters by role=reviewer when the caller is only a reviewer", async () => {
    const { organization, project } = await seedActiveCampaignWithTester()
    // The caller from the seed is a tester. Add a second active campaign on
    // which the same caller is a reviewer.
    const reviewerAgent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(reviewerAgent)
    const reviewerCampaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent: reviewerAgent })
        .build(),
    )
    const callerUser = await repositories.userRepository.findOneByOrFail({ auth0Id })
    await repositories.reviewCampaignMembershipRepository.save(
      reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign: reviewerCampaign, user: callerUser })
        .build(),
    )

    // Default (no role → tester): returns only the tester campaign.
    const testerResponse = await request({
      route: ReviewCampaignsRoutes.getMyReviewCampaigns,
      token: accessToken,
    })
    expectResponse(testerResponse, 200)
    expect(testerResponse.body.data.reviewCampaigns).toHaveLength(1)
    expect(testerResponse.body.data.reviewCampaigns[0]?.id).toBe(reviewCampaignId)

    // role=reviewer: returns only the reviewer campaign.
    const reviewerResponse = await request({
      route: ReviewCampaignsRoutes.getMyReviewCampaigns,
      token: accessToken,
      query: { role: "reviewer" },
    })
    expectResponse(reviewerResponse, 200)
    expect(reviewerResponse.body.data.reviewCampaigns).toHaveLength(1)
    expect(reviewerResponse.body.data.reviewCampaigns[0]?.id).toBe(reviewerCampaign.id)
  })

  it("getMyReviewCampaigns includes closed campaigns for reviewers only", async () => {
    const { organization, project } = await seedActiveCampaignWithTester()
    const reviewerAgent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(reviewerAgent)
    const callerUser = await repositories.userRepository.findOneByOrFail({ auth0Id })
    const closedCampaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .closed()
        .transient({ organization, project, agent: reviewerAgent })
        .build(),
    )
    const draftCampaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.transient({ organization, project, agent: reviewerAgent }).build(),
    )
    await repositories.reviewCampaignMembershipRepository.save([
      reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign: closedCampaign, user: callerUser })
        .build(),
      reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign: draftCampaign, user: callerUser })
        .build(),
    ])

    const reviewerResponse = await request({
      route: ReviewCampaignsRoutes.getMyReviewCampaigns,
      token: accessToken,
      query: { role: "reviewer" },
    })
    expectResponse(reviewerResponse, 200)
    const campaignIds = reviewerResponse.body.data.reviewCampaigns.map(
      (campaign: { id: string }) => campaign.id,
    )
    expect(campaignIds).toContain(closedCampaign.id)
    expect(campaignIds).not.toContain(draftCampaign.id)

    const testerResponse = await request({
      route: ReviewCampaignsRoutes.getMyReviewCampaigns,
      token: accessToken,
    })
    expectResponse(testerResponse, 200)
    expect(
      testerResponse.body.data.reviewCampaigns.map((campaign: { id: string }) => campaign.id),
    ).toEqual([reviewCampaignId])
  })

  it("getMyReviewCampaigns rejects an unknown role filter (400)", async () => {
    await seedActiveCampaignWithTester()
    const response = await request({
      route: ReviewCampaignsRoutes.getMyReviewCampaigns,
      token: accessToken,
      query: { role: "admin" },
    })
    expectResponse(response, 400)
  })

  it("startTesterSession creates a conversation session stamped with campaign_id", async () => {
    await seedActiveCampaignWithTester("conversation")
    const response = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    expectResponse(response, 201)
    expect(response.body.data.agentType).toBe("conversation")

    const session = await repositories.conversationAgentSessionRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(session?.campaignId).toBe(reviewCampaignId)
  })

  it("listMyTesterSessions returns sessions for this campaign with feedback status", async () => {
    await seedActiveCampaignWithTester()

    const first = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    const pendingSessionId = first.body.data.id

    const second = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    const submittedSessionId = second.body.data.id

    await request({
      route: ReviewCampaignsRoutes.submitTesterFeedback,
      pathParams: removeNullish({ organizationId, projectId, sessionId: submittedSessionId }),
      token: accessToken,
      request: { payload: { overallRating: 4 } },
    })

    const response = await request({
      route: ReviewCampaignsRoutes.listMyTesterSessions,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })
    expectResponse(response, 200)
    const sessions = response.body.data.sessions
    expect(sessions).toHaveLength(2)
    const submittedEntry = sessions.find((entry) => entry.id === submittedSessionId)
    const pendingEntry = sessions.find((entry) => entry.id === pendingSessionId)
    expect(submittedEntry?.feedbackStatus).toBe("submitted")
    expect(pendingEntry?.feedbackStatus).toBe("pending")
  })

  it("startTesterSession refuses extraction agents (422)", async () => {
    await seedActiveCampaignWithTester("extraction" as "conversation")
    const response = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    expectResponse(response, 422)
  })

  it("submitTesterFeedback then updateTesterFeedback; duplicate submit → 409", async () => {
    await seedActiveCampaignWithTester()
    const sessionStart = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    const sessionId = sessionStart.body.data.id

    const submit = await request({
      route: ReviewCampaignsRoutes.submitTesterFeedback,
      pathParams: removeNullish({ organizationId, projectId, sessionId }),
      token: accessToken,
      request: {
        payload: {
          overallRating: 4,
          comment: "Solid experience",
          answers: [{ questionId: "q1", value: 4 }],
        },
      },
    })
    expectResponse(submit, 201)
    expect(submit.body.data.overallRating).toBe(4)

    const duplicate = await request({
      route: ReviewCampaignsRoutes.submitTesterFeedback,
      pathParams: removeNullish({ organizationId, projectId, sessionId }),
      token: accessToken,
      request: { payload: { overallRating: 3 } },
    })
    expectResponse(duplicate, 409)

    const update = await request({
      route: ReviewCampaignsRoutes.updateTesterFeedback,
      pathParams: removeNullish({ organizationId, projectId, sessionId }),
      token: accessToken,
      request: { payload: { overallRating: 5 } },
    })
    expectResponse(update, 200)
    expect(update.body.data.overallRating).toBe(5)
  })

  it("submitTesterFeedback refuses rating outside 1-5 (422)", async () => {
    await seedActiveCampaignWithTester()
    const sessionStart = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    const sessionId = sessionStart.body.data.id

    const response = await request({
      route: ReviewCampaignsRoutes.submitTesterFeedback,
      pathParams: removeNullish({ organizationId, projectId, sessionId }),
      token: accessToken,
      request: { payload: { overallRating: 0 } },
    })
    expectResponse(response, 422)
  })

  it("submitTesterSurvey then update; duplicate → 409", async () => {
    await seedActiveCampaignWithTester()

    const submit = await request({
      route: ReviewCampaignsRoutes.submitTesterSurvey,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: {
        payload: { overallRating: 4, comment: "Would recommend", answers: [] },
      },
    })
    expectResponse(submit, 201)

    const duplicate = await request({
      route: ReviewCampaignsRoutes.submitTesterSurvey,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { overallRating: 3 } },
    })
    expectResponse(duplicate, 409)

    const update = await request({
      route: ReviewCampaignsRoutes.updateTesterSurvey,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { comment: "Even more so" } },
    })
    expectResponse(update, 200)
    expect(update.body.data.comment).toBe("Even more so")
  })

  it("getMyTesterSurvey returns null when no survey, then returns the survey after submit", async () => {
    await seedActiveCampaignWithTester()

    const before = await request({
      route: ReviewCampaignsRoutes.getMyTesterSurvey,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })
    expectResponse(before, 200)
    expect(before.body.data.survey).toBeNull()

    await request({
      route: ReviewCampaignsRoutes.submitTesterSurvey,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { overallRating: 5, comment: "Excellent" } },
    })

    const after = await request({
      route: ReviewCampaignsRoutes.getMyTesterSurvey,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })
    expectResponse(after, 200)
    expect(after.body.data.survey).toMatchObject({
      campaignId: reviewCampaignId,
      overallRating: 5,
      comment: "Excellent",
    })
  })

  it("deleteTesterSession deletes a pending session; session no longer in list", async () => {
    await seedActiveCampaignWithTester()

    const sessionStart = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    const sessionId = sessionStart.body.data.id

    const deleteResponse = await request({
      route: ReviewCampaignsRoutes.deleteTesterSession,
      pathParams: removeNullish({ organizationId, projectId, sessionId }),
      token: accessToken,
    })
    expectResponse(deleteResponse, 200)

    const listResponse = await request({
      route: ReviewCampaignsRoutes.listMyTesterSessions,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })
    expectResponse(listResponse, 200)
    expect(listResponse.body.data.sessions).toHaveLength(0)
  })

  it("deleteTesterSession rejects deletion if feedback exists (409)", async () => {
    await seedActiveCampaignWithTester()

    const sessionStart = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    const sessionId = sessionStart.body.data.id

    await request({
      route: ReviewCampaignsRoutes.submitTesterFeedback,
      pathParams: removeNullish({ organizationId, projectId, sessionId }),
      token: accessToken,
      request: { payload: { overallRating: 4 } },
    })

    const deleteResponse = await request({
      route: ReviewCampaignsRoutes.deleteTesterSession,
      pathParams: removeNullish({ organizationId, projectId, sessionId }),
      token: accessToken,
    })
    expectResponse(deleteResponse, 409)
  })

  it("getOne returns aggregates for closed campaigns and null for active ones", async () => {
    const { campaign } = await seedActiveCampaignWithTester()

    const firstSession = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    const secondSession = await request({
      route: ReviewCampaignsRoutes.startTesterSession,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { type: "live" } },
    })
    await request({
      route: ReviewCampaignsRoutes.submitTesterFeedback,
      pathParams: removeNullish({
        organizationId,
        projectId,
        sessionId: firstSession.body.data.id,
      }),
      token: accessToken,
      request: { payload: { overallRating: 4 } },
    })
    await request({
      route: ReviewCampaignsRoutes.submitTesterFeedback,
      pathParams: removeNullish({
        organizationId,
        projectId,
        sessionId: secondSession.body.data.id,
      }),
      token: accessToken,
      request: { payload: { overallRating: 5 } },
    })
    await request({
      route: ReviewCampaignsRoutes.submitTesterSurvey,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
      request: { payload: { overallRating: 5 } },
    })

    const activeDetail = await request({
      route: ReviewCampaignsRoutes.getOne,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })
    expectResponse(activeDetail, 200)
    expect(activeDetail.body.data.aggregates).toBeNull()

    await repositories.reviewCampaignRepository.update(campaign.id, {
      status: "closed",
      closedAt: new Date(),
    })

    const closedDetail = await request({
      route: ReviewCampaignsRoutes.getOne,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })
    expectResponse(closedDetail, 200)
    expect(closedDetail.body.data.aggregates).toEqual({
      meanTesterRating: 4.5,
      surveyCount: 1,
      sessionCount: 2,
    })
  })

  it("getOne returns zeroed aggregates for closed campaigns with no activity", async () => {
    const { campaign } = await seedActiveCampaignWithTester()
    await repositories.reviewCampaignRepository.update(campaign.id, {
      status: "closed",
      closedAt: new Date(),
    })

    const response = await request({
      route: ReviewCampaignsRoutes.getOne,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken,
    })
    expectResponse(response, 200)
    expect(response.body.data.aggregates).toEqual({
      meanTesterRating: null,
      surveyCount: 0,
      sessionCount: 0,
    })
  })
})
