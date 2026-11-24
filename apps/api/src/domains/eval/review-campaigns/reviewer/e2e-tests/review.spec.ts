import { randomUUID } from "node:crypto"
import { EvalReviewerRoutes } from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation reviewer - Reviewer happy path", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let sessionId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let accessToken: string = "token"
  let authSubject = `oidc|reviewer-${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = `oidc|reviewer-${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * Seeds: org + project + agent + active campaign + reviewer membership for the
   * caller + a separate tester user who owns a conversation session stamped with
   * the campaignId. The caller (reviewer) can then submit a review against that
   * session.
   */
  const seedReviewableSession = async () => {
    const {
      organization,
      project,
      user: reviewer,
      agent,
      agentSettings,
    } = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
      agent: { type: "conversation" },
    })
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-${randomUUID()}@example.com` }),
    )
    const campaign = reviewCampaignFactory
      .active()
      .transient({ organization, project, agent, agentSettings })
      .build({
        reviewerQuestions: [
          { id: "rv-1", prompt: "Factually correct?", type: "rating", required: true },
        ],
      })
    await repositories.reviewCampaignRepository.save(campaign)
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_reviewer")
        .transient({ organization, project, campaign, user: reviewer })
        .build(),
    })
    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session)

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    sessionId = session.id

    return { organization, project, reviewer, tester, agent, campaign, session }
  }

  it("createReview creates a review for the session", async () => {
    await seedReviewableSession()

    const response = await request({
      route: EvalReviewerRoutes.createReview,
      pathParams: { organizationId, projectId, reviewCampaignId, sessionId },
      token: accessToken,
      body: {
        payload: {
          overallRating: 4,
          comment: "Solid run",
          answers: [{ questionId: "rv-1", value: 5 }],
        },
      },
    })
    expectSchemaResponse(EvalReviewerRoutes.createReview, response, 201)
    expect(response.body.data.overallRating).toBe(4)
    expect(response.body.data.comment).toBe("Solid run")
    expect(response.body.data.reviewerUserId).toEqual(expect.any(String))
  })

  it("createReview rejects a second review by the same reviewer (409)", async () => {
    await seedReviewableSession()

    const first = await request({
      route: EvalReviewerRoutes.createReview,
      pathParams: { organizationId, projectId, reviewCampaignId, sessionId },
      token: accessToken,
      body: { payload: { overallRating: 4, comment: null, answers: [] } },
    })
    expectResponse(first, 201)

    const duplicate = await request({
      route: EvalReviewerRoutes.createReview,
      pathParams: { organizationId, projectId, reviewCampaignId, sessionId },
      token: accessToken,
      body: { payload: { overallRating: 3, comment: null, answers: [] } },
    })
    expectResponse(duplicate, 409)
  })

  it("createReview rejects a reviewer reviewing their own tester session (403)", async () => {
    const {
      organization,
      project,
      user: reviewer,
      agent,
      agentSettings,
    } = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
      agent: { type: "conversation" },
    })
    const campaign = reviewCampaignFactory
      .active()
      .transient({ organization, project, agent, agentSettings })
      .build({})
    await repositories.reviewCampaignRepository.save(campaign)
    // Same user is both reviewer AND the session owner (tester) — self-review.
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_reviewer")
        .transient({ organization, project, campaign, user: reviewer })
        .build(),
    })
    const ownSession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: reviewer })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(ownSession)
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id

    const response = await request({
      route: EvalReviewerRoutes.createReview,
      pathParams: {
        organizationId,
        projectId,
        reviewCampaignId,
        sessionId: ownSession.id,
      },
      token: accessToken,
      body: { payload: { overallRating: 4, comment: null, answers: [] } },
    })
    expectResponse(response, 403)
  })

  it("createReview refuses a rating outside 1-5 (400)", async () => {
    await seedReviewableSession()

    const response = await request({
      route: EvalReviewerRoutes.createReview,
      pathParams: { organizationId, projectId, reviewCampaignId, sessionId },
      token: accessToken,
      body: { payload: { overallRating: 0, comment: null, answers: [] } },
    })
    expectResponse(response, 400)
  })

  it("answers 400 for a review with no rating", async () => {
    await seedReviewableSession()

    const response = await request({
      route: EvalReviewerRoutes.createReview,
      pathParams: { organizationId, projectId, reviewCampaignId, sessionId },
      token: accessToken,
      body: { payload: { comment: "No rating", answers: [] } },
    })
    expectResponse(response, 400)
  })

  it("updateReview updates the caller's own review", async () => {
    await seedReviewableSession()

    const submit = await request({
      route: EvalReviewerRoutes.createReview,
      pathParams: { organizationId, projectId, reviewCampaignId, sessionId },
      token: accessToken,
      body: { payload: { overallRating: 3, comment: null, answers: [] } },
    })
    const reviewId = submit.body.data.id

    const update = await request({
      route: EvalReviewerRoutes.updateReview,
      pathParams: {
        organizationId,
        projectId,
        reviewCampaignId,
        sessionId,
        reviewId,
      },
      token: accessToken,
      body: { payload: { overallRating: 5, comment: "After rerun", answers: [] } },
    })
    expectSchemaResponse(EvalReviewerRoutes.updateReview, update, 200)
    expect(update.body.data.overallRating).toBe(5)
    expect(update.body.data.comment).toBe("After rerun")
  })

  it("updateReview returns 404 for an unknown reviewId", async () => {
    await seedReviewableSession()

    const response = await request({
      route: EvalReviewerRoutes.updateReview,
      pathParams: {
        organizationId,
        projectId,
        reviewCampaignId,
        sessionId,
        reviewId: randomUUID(),
      },
      token: accessToken,
      body: { payload: { overallRating: 5, comment: null, answers: [] } },
    })
    expectResponse(response, 404)
  })

  it("updateReview returns 403 when updating another reviewer's review", async () => {
    const { organization, project, campaign, session } = await seedReviewableSession()
    // Create a second reviewer whose review the caller will try to edit.
    const otherReviewer = await repositories.userRepository.save(
      userFactory.build({ email: `other-reviewer-${randomUUID()}@example.com` }),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_reviewer")
        .transient({ organization, project, campaign, user: otherReviewer })
        .build(),
    })
    const theirReview = await repositories.reviewerSessionReviewRepository.save({
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
      sessionId: session.id,
      agentType: "conversation",
      reviewerUserId: otherReviewer.id,
      overallRating: 3,
      comment: null,
      answers: [],
      submittedAt: new Date(),
    })

    const response = await request({
      route: EvalReviewerRoutes.updateReview,
      pathParams: {
        organizationId,
        projectId,
        reviewCampaignId,
        sessionId,
        reviewId: theirReview.id,
      },
      token: accessToken,
      body: { payload: { overallRating: 1, comment: null, answers: [] } },
    })
    expectResponse(response, 403)
  })
})
