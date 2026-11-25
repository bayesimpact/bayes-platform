import { randomUUID } from "node:crypto"
import { EvalReviewCampaignsRoutes } from "@caseai-connect/eval-contracts"
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
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation review campaigns - getReport", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let authSubject = `oidc|${randomUUID()}`

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
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** An active campaign with its questions, owned by the caller's project, and no session. */
  const createCampaign = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject }, agent: { type: "conversation" } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build({
          testerPerSessionQuestions: [
            { id: "tp-1", prompt: "Was the agent helpful?", type: "rating", required: true },
            {
              id: "tp-2",
              prompt: "Pick a tag",
              type: "single-choice",
              options: ["Product", "Pricing", "Support"],
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
        }),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, agent, campaign }
  }

  /**
   * Two sessions of two testers: the first with the tester's feedback and two reviews rated 2 and
   * 4, the second with the tester's feedback only. One end-of-phase survey.
   */
  const seedReportableCampaign = async () => {
    const { organization, project, agent, campaign } = await createCampaign()
    const [firstTester, secondTester, firstReviewer, secondReviewer] =
      await repositories.userRepository.save([
        userFactory.build(),
        userFactory.build(),
        userFactory.build(),
        userFactory.build(),
      ])
    if (!firstTester || !secondTester || !firstReviewer || !secondReviewer)
      throw new Error("factory returned empty")
    const firstSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user: firstTester })
        .build({ campaignId: campaign.id }),
    )
    const secondSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user: secondTester })
        .build({ campaignId: campaign.id }),
    )
    const scope = {
      organizationId: organization.id,
      projectId: project.id,
      campaignId: campaign.id,
    }
    await repositories.testerSessionFeedbackRepository.save({
      ...scope,
      sessionId: firstSession.id,
      agentType: "conversation",
      overallRating: 5,
      comment: null,
      answers: [
        { questionId: "tp-1", value: 4 },
        { questionId: "tp-2", value: "Product" },
      ],
    })
    await repositories.testerSessionFeedbackRepository.save({
      ...scope,
      sessionId: secondSession.id,
      agentType: "conversation",
      overallRating: 3,
      comment: null,
      answers: [{ questionId: "tp-1", value: 2 }],
    })
    for (const [reviewer, overallRating] of [
      [firstReviewer, 2],
      [secondReviewer, 4],
    ] as const) {
      await repositories.reviewerSessionReviewRepository.save({
        ...scope,
        sessionId: firstSession.id,
        agentType: "conversation",
        reviewerUserId: reviewer.id,
        overallRating,
        comment: null,
        answers: [
          { questionId: "rv-1", value: overallRating },
          { questionId: "rv-2", value: "A summary" },
        ],
        submittedAt: new Date(),
      })
    }
    await repositories.testerCampaignSurveyRepository.save({
      ...scope,
      userId: firstTester.id,
      overallRating: 5,
      comment: null,
      answers: [{ questionId: "tp-end", value: 5 }],
      submittedAt: new Date(),
    })
    return { organization, project, agent, campaign, firstTester, firstSession, secondSession }
  }

  const subject = () =>
    request({
      route: EvalReviewCampaignsRoutes.getReport,
      pathParams: { organizationId, projectId, reviewCampaignId },
      token: "token",
    })

  it("returns the headline, the distributions and the session matrix", async () => {
    const { firstTester, firstSession, secondSession } = await seedReportableCampaign()

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getReport, response)
    const report = response.body.data
    expect(report.headline).toStrictEqual({
      sessionCount: 2,
      testerFeedbackCount: 2,
      reviewerReviewCount: 2,
      meanTesterRating: 4,
      meanReviewerRating: 3,
      meanEndOfPhaseRating: 5,
      participantCount: 2,
    })

    const ratingQuestion = report.testerPerSessionDistributions.find(
      (distribution) => distribution.questionId === "tp-1",
    )
    expect(ratingQuestion?.responseCount).toBe(2)
    expect(ratingQuestion?.buckets).toStrictEqual([
      { label: "1", count: 0 },
      { label: "2", count: 1 },
      { label: "3", count: 0 },
      { label: "4", count: 1 },
      { label: "5", count: 0 },
    ])
    const choiceQuestion = report.testerPerSessionDistributions.find(
      (distribution) => distribution.questionId === "tp-2",
    )
    expect(choiceQuestion?.responseCount).toBe(1)
    expect(choiceQuestion?.buckets).toStrictEqual([
      { label: "Product", count: 1 },
      { label: "Pricing", count: 0 },
      { label: "Support", count: 0 },
    ])
    expect(report.testerEndOfPhaseDistributions).toHaveLength(1)
    const freeTextQuestion = report.reviewerDistributions.find(
      (distribution) => distribution.questionId === "rv-2",
    )
    expect(freeTextQuestion).toStrictEqual({
      questionId: "rv-2",
      prompt: "Any issues?",
      type: "free-text",
      responseCount: 2,
      buckets: [],
    })

    const firstRow = report.sessionMatrix.find((row) => row.sessionId === firstSession.id)
    expect(firstRow).toStrictEqual({
      sessionId: firstSession.id,
      testerUserId: firstTester.id,
      startedAt: firstSession.createdAt.getTime(),
      testerRating: 5,
      reviewerRatings: expect.arrayContaining([2, 4]),
      reviewerCount: 2,
      meanReviewerRating: 3,
      reviewerRatingSpread: 2,
    })
    const secondRow = report.sessionMatrix.find((row) => row.sessionId === secondSession.id)
    expect(secondRow).toMatchObject({
      testerRating: 3,
      reviewerRatings: [],
      reviewerCount: 0,
      meanReviewerRating: null,
      reviewerRatingSpread: null,
    })
  })

  it("lists a session with no feedback and no review, with no rating", async () => {
    const { organization, project, agent, campaign, firstTester } = await seedReportableCampaign()
    const sessionWithoutFeedback = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user: firstTester })
        .build({ campaignId: campaign.id }),
    )

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getReport, response)
    const report = response.body.data
    expect(report.headline.sessionCount).toBe(3)
    expect(report.sessionMatrix).toHaveLength(3)
    expect(
      report.sessionMatrix.find((row) => row.sessionId === sessionWithoutFeedback.id),
    ).toMatchObject({
      testerRating: null,
      reviewerRatings: [],
      reviewerCount: 0,
      meanReviewerRating: null,
      reviewerRatingSpread: null,
    })
  })

  it("returns the report of a campaign with no session", async () => {
    await createCampaign()

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getReport, response)
    const report = response.body.data
    expect(report.headline).toStrictEqual({
      sessionCount: 0,
      testerFeedbackCount: 0,
      reviewerReviewCount: 0,
      meanTesterRating: null,
      meanReviewerRating: null,
      meanEndOfPhaseRating: null,
      participantCount: 0,
    })
    expect(report.sessionMatrix).toEqual([])
    expect(
      [
        ...report.testerPerSessionDistributions,
        ...report.testerEndOfPhaseDistributions,
        ...report.reviewerDistributions,
      ].map((distribution) => distribution.responseCount),
    ).toEqual([0, 0, 0, 0, 0])
  })

  it("works on a closed campaign", async () => {
    const { campaign } = await seedReportableCampaign()
    await repositories.reviewCampaignRepository.update(
      { id: campaign.id },
      { status: "closed", closedAt: new Date() },
    )

    const response = await subject()

    expectSchemaResponse(EvalReviewCampaignsRoutes.getReport, response)
    expect(response.body.data.headline.sessionCount).toBe(2)
  })
})
