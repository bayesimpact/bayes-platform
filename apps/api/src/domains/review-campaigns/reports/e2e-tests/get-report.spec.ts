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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import {
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import {
  projectMembershipFactory,
  saveProjectMembership,
} from "@/domains/projects/memberships/project-membership.factory"
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
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-report" }),
}

describe("ReviewCampaigns - Report", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let accessToken: string | null = "token"
  let auth0Id = `auth0|report-${randomUUID()}`

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
    auth0Id = `auth0|report-${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * Seeds a richly populated campaign: two conversation sessions (one with
   * tester feedback + two reviewer reviews of differing ratings, one with no
   * feedback), one form session, plus an end-of-phase survey. The caller is
   * the project owner (admin). Tests override auth0Id to flip roles.
   */
  const seedReportableCampaign = async () => {
    const {
      organization,
      project,
      user: owner,
    } = await createOrganizationWithProject(repositories, { user: { auth0Id } })
    const tester1 = await repositories.userRepository.save(
      userFactory.build({ email: `tester1-${randomUUID()}@example.com` }),
    )
    const tester2 = await repositories.userRepository.save(
      userFactory.build({ email: `tester2-${randomUUID()}@example.com` }),
    )
    const reviewerA = await repositories.userRepository.save(
      userFactory.build({ email: `rvA-${randomUUID()}@example.com` }),
    )
    // Reviewers still need org membership to pass the organization-context
    // resolver (same requirement as the existing reviewer endpoints).
    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory
        .transient({ user: reviewerA, organization })
        .build(),
    })
    const reviewerB = await repositories.userRepository.save(
      userFactory.build({ email: `rvB-${randomUUID()}@example.com` }),
    )

    const agent = agentFactory.transient({ organization, project }).build({ type: "conversation" })
    await repositories.agentRepository.save(agent)

    const agentSettings = agentSettingsFactory.transient({ organization, project, agent }).build()
    await repositories.agentSettingsRepository.save(agentSettings)

    const campaign = reviewCampaignFactory
      .active()
      .transient({ organization, project, agent, agentSettings })
      .build({
        testerPerSessionQuestions: [
          { id: "tp-1", prompt: "Was the agent helpful?", type: "rating", required: true },
          {
            id: "tp-2",
            prompt: "Pick a tag",
            type: "single-choice",
            options: ["good", "ok", "bad"],
            required: false,
          },
        ],
        testerEndOfPhaseQuestions: [
          { id: "tp-end", prompt: "Overall impression?", type: "rating", required: true },
        ],
        reviewerQuestions: [
          { id: "rv-1", prompt: "Was the response accurate?", type: "rating", required: true },
          { id: "rv-2", prompt: "Any issues?", type: "free-text", required: false },
        ],
      })
    await repositories.reviewCampaignRepository.save(campaign)

    // Both reviewers are accepted reviewer members.
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign, user: reviewerA })
        .build(),
    })
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .reviewer()
        .accepted()
        .transient({ organization, project, campaign, user: reviewerB })
        .build(),
    })

    const session1 = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester1 })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session1)
    const session2 = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester2 })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session2)

    const formAgent = agentFactory.transient({ organization, project }).build({ type: "form" })
    await repositories.agentRepository.save(formAgent)
    const formSession = formAgentSessionFactory
      .transient({ organization, project, agent: formAgent, user: tester1 })
      .build({ campaignId: campaign.id })
    await repositories.formAgentSessionRepository.save(formSession)

    // session1: tester feedback rating=5 + answers; two reviewer reviews (2 & 4).
    await repositories.testerSessionFeedbackRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session1.id,
      agentType: "conversation",
      overallRating: 5,
      comment: null,
      answers: [
        { questionId: "tp-1", value: 4 },
        { questionId: "tp-2", value: "good" },
      ],
    })
    await repositories.reviewerSessionReviewRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session1.id,
      agentType: "conversation",
      reviewerUserId: reviewerA.id,
      overallRating: 2,
      comment: null,
      answers: [
        { questionId: "rv-1", value: 3 },
        { questionId: "rv-2", value: "some concerns" },
      ],
      submittedAt: new Date(),
    })
    await repositories.reviewerSessionReviewRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session1.id,
      agentType: "conversation",
      reviewerUserId: reviewerB.id,
      overallRating: 4,
      comment: null,
      answers: [{ questionId: "rv-1", value: 4 }],
      submittedAt: new Date(),
    })

    // session2: tester feedback rating=3; no reviewer reviews yet.
    await repositories.testerSessionFeedbackRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session2.id,
      agentType: "conversation",
      overallRating: 3,
      comment: null,
      answers: [{ questionId: "tp-1", value: 2 }],
    })

    // End-of-phase survey from tester1 (rating 5).
    await repositories.testerCampaignSurveyRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      userId: tester1.id,
      overallRating: 5,
      comment: null,
      answers: [{ questionId: "tp-end", value: 5 }],
      submittedAt: new Date(),
    })

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    return {
      organization,
      project,
      campaign,
      owner,
      tester1,
      tester2,
      reviewerA,
      reviewerB,
      session1,
      session2,
      formSession,
    }
  }

  const subject = async () =>
    request({
      route: ReviewCampaignsRoutes.getCampaignReport,
      pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
      token: accessToken ?? undefined,
    })

  it("returns the aggregate report for the project owner", async () => {
    await seedReportableCampaign()
    const response = await subject()
    expectResponse(response, 200)

    const data = response.body.data
    expect(data.campaignId).toBe(reviewCampaignId)
    expect(data.headline.sessionCount).toBe(3)
    expect(data.headline.testerFeedbackCount).toBe(2)
    expect(data.headline.reviewerReviewCount).toBe(2)
    expect(data.headline.meanTesterRating).toBe(4)
    expect(data.headline.meanReviewerRating).toBe(3)
    expect(data.headline.meanEndOfPhaseRating).toBe(5)
    expect(data.headline.participantCount).toBe(2)
    expect(data.sessionMatrix).toHaveLength(3)
  })

  it("returns rating/single-choice distributions with configured buckets", async () => {
    await seedReportableCampaign()
    const response = await subject()
    expectResponse(response, 200)

    const perSession = response.body.data.testerPerSessionDistributions as Array<{
      questionId: string
      responseCount: number
      buckets: Array<{ label: string; count: number }>
    }>
    const tp1 = perSession.find((entry) => entry.questionId === "tp-1")
    expect(tp1?.responseCount).toBe(2)
    expect(tp1?.buckets.map((bucket) => bucket.label)).toEqual(["1", "2", "3", "4", "5"])
    expect(tp1?.buckets.find((bucket) => bucket.label === "4")?.count).toBe(1)
    expect(tp1?.buckets.find((bucket) => bucket.label === "2")?.count).toBe(1)

    const tp2 = perSession.find((entry) => entry.questionId === "tp-2")
    expect(tp2?.responseCount).toBe(1)
    expect(tp2?.buckets.map((bucket) => bucket.label)).toEqual(["good", "ok", "bad"])
    expect(tp2?.buckets.find((bucket) => bucket.label === "good")?.count).toBe(1)
  })

  it("returns free-text questions with responseCount only (no buckets)", async () => {
    await seedReportableCampaign()
    const response = await subject()
    expectResponse(response, 200)

    const reviewerDist = response.body.data.reviewerDistributions as Array<{
      questionId: string
      type: string
      responseCount: number
      buckets: unknown[]
    }>
    const rv2 = reviewerDist.find((entry) => entry.questionId === "rv-2")
    expect(rv2?.type).toBe("free-text")
    expect(rv2?.responseCount).toBe(1)
    expect(rv2?.buckets).toEqual([])
  })

  it("computes session-row reviewer ratings, mean, and spread", async () => {
    const { session1, session2, formSession } = await seedReportableCampaign()
    const response = await subject()
    expectResponse(response, 200)

    const rows = response.body.data.sessionMatrix as Array<{
      sessionId: string
      reviewerRatings: number[]
      reviewerCount: number
      meanReviewerRating: number | null
      reviewerRatingSpread: number | null
      testerRating: number | null
    }>
    const row1 = rows.find((row) => row.sessionId === session1.id)
    expect(row1?.reviewerRatings.sort()).toEqual([2, 4])
    expect(row1?.reviewerCount).toBe(2)
    expect(row1?.meanReviewerRating).toBe(3)
    expect(row1?.reviewerRatingSpread).toBe(2)
    expect(row1?.testerRating).toBe(5)

    const row2 = rows.find((row) => row.sessionId === session2.id)
    expect(row2?.reviewerCount).toBe(0)
    expect(row2?.meanReviewerRating).toBeNull()
    expect(row2?.reviewerRatingSpread).toBeNull()

    const rowForm = rows.find((row) => row.sessionId === formSession.id)
    expect(rowForm?.reviewerCount).toBe(0)
    expect(rowForm?.testerRating).toBeNull()
  })

  it("allows an accepted reviewer to fetch the report", async () => {
    const { reviewerA } = await seedReportableCampaign()
    // Caller is now reviewerA (non-admin). The userGuard override picks up
    // auth0Id at request time.
    auth0Id = reviewerA.auth0Id

    const response = await subject()
    expectResponse(response, 200)
    expect(response.body.data.campaignId).toBe(reviewCampaignId)
  })

  it("rejects a user who isn't a member of the organization (401)", async () => {
    await seedReportableCampaign()
    const outsider = await repositories.userRepository.save(
      userFactory.build({ email: `outsider-${randomUUID()}@example.com` }),
    )
    auth0Id = outsider.auth0Id

    const response = await subject()
    expectResponse(response, 401)
  })

  it("forbids a tester-only member (403)", async () => {
    const { organization, project, campaign } = await seedReportableCampaign()
    // Tester is a project "member" — passes org/project context resolution
    // but fails both canView-as-admin (needs admin/owner) and canView-as-
    // reviewer (needs reviewer role). End-state: 403.
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-only-${randomUUID()}@example.com` }),
    )
    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory.transient({ user: tester, organization }).build(),
    })
    await saveProjectMembership({
      repositories,
      membership: projectMembershipFactory.member().transient({ user: tester, project }).build(),
    })
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .tester()
        .accepted()
        .transient({ organization, project, campaign, user: tester })
        .build(),
    })
    auth0Id = tester.auth0Id

    const response = await subject()
    expectResponse(response, 403)
  })

  it("requires an authentication token (401)", async () => {
    await seedReportableCampaign()
    accessToken = null
    const response = await subject()
    expectResponse(response, 401)
  })

  it("works on closed campaigns (report is the main closed-campaign view)", async () => {
    const { campaign } = await seedReportableCampaign()
    // `update` instead of `save` avoids the default cascade through relations
    // (reviewer-session-reviews, memberships, etc.) which otherwise tries to
    // re-insert their rows and violates the campaign_id NOT NULL constraint.
    await repositories.reviewCampaignRepository.update(
      { id: campaign.id },
      { status: "closed", closedAt: new Date() },
    )

    const response = await subject()
    expectResponse(response, 200)
  })
})
