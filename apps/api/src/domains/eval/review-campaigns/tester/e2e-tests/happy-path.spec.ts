import { randomUUID } from "node:crypto"
import { EvalTesterRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { conversationFormFactory } from "@/domains/agents/shared/conversation-forms/conversation-form.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation tester - happy path", () => {
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

  const seedActiveCampaignWithTester = async ({
    agentType = "conversation",
    agentSettings: agentSettingsOverrides = {},
  }: {
    agentType?: "conversation" | "extraction"
    agentSettings?: Partial<AgentSettings>
  } = {}) => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        agent: { type: agentType },
        agentSettings: agentSettingsOverrides,
      },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build({
          testerPerSessionQuestions: [
            { id: "q1", prompt: "Was it clear?", type: "rating", required: true },
          ],
          testerEndOfPhaseQuestions: [
            { id: "s1", prompt: "Would you recommend?", type: "rating", required: false },
          ],
        }),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .withRoles("review_campaign_tester")
        .transient({ organization, project, campaign, user })
        .build(),
    })

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, user, agent, agentSettings, campaign }
  }

  const campaignParams = () => ({ organizationId, projectId, reviewCampaignId })
  const sessionParams = (sessionId: string) => ({ organizationId, projectId, sessionId })

  const startSession = () =>
    request({
      route: EvalTesterRoutes.startSession,
      pathParams: campaignParams(),
      token: "token",
      body: { payload: {} },
    })

  const startSessionId = async (): Promise<string> => {
    const response = await startSession()
    expectResponse(response, 201)
    return response.body.data.id
  }

  const getSessions = () =>
    request({ route: EvalTesterRoutes.getSessions, pathParams: campaignParams(), token: "token" })

  const createFeedback = (sessionId: string, payload: unknown) =>
    request({
      route: EvalTesterRoutes.createFeedback,
      pathParams: sessionParams(sessionId),
      token: "token",
      body: { payload },
    })

  const deleteSession = (sessionId: string) =>
    request({
      route: EvalTesterRoutes.deleteSession,
      pathParams: sessionParams(sessionId),
      token: "token",
    })

  const getSurvey = () =>
    request({ route: EvalTesterRoutes.getSurvey, pathParams: campaignParams(), token: "token" })

  const createSurvey = (payload: unknown) =>
    request({
      route: EvalTesterRoutes.createSurvey,
      pathParams: campaignParams(),
      token: "token",
      body: { payload },
    })

  const updateSurvey = (payload: unknown) =>
    request({
      route: EvalTesterRoutes.updateSurvey,
      pathParams: campaignParams(),
      token: "token",
      body: { payload },
    })

  describe("startSession", () => {
    it("starts a session with an empty payload, stamped with the campaign", async () => {
      await seedActiveCampaignWithTester()

      const response = await startSession()

      expectSchemaResponse(EvalTesterRoutes.startSession, response, 201)
      const session = await repositories.conversationAgentSessionRepository.findOneOrFail({
        where: { id: response.body.data.id },
      })
      expect(session.campaignId).toBe(reviewCampaignId)
      expect(session.type).toBe("review_campaign_tester")
    })

    it("answers 400 for a payload with a key the schema does not declare", async () => {
      await seedActiveCampaignWithTester()

      const response = await request({
        route: EvalTesterRoutes.startSession,
        pathParams: campaignParams(),
        token: "token",
        body: { payload: { agentId: randomUUID() } },
      })

      expectResponse(response, 400)
      expect(await repositories.conversationAgentSessionRepository.count()).toBe(0)
    })

    it("runs the version the campaign chose, not the one in production", async () => {
      const { organization, project, agent, campaign } = await seedActiveCampaignWithTester({
        agentSettings: { greetingMessage: "Hello from production" },
      })
      const campaignVersion = await repositories.agentSettingsRepository.save(
        agentSettingsFactory
          .transient({ organization, project, agent })
          .build({ revision: 7, greetingMessage: "Hello from the campaign's version" }),
      )
      await repositories.reviewCampaignRepository.update(
        { id: campaign.id },
        { agentSettingsId: campaignVersion.id },
      )

      const sessionId = await startSessionId()

      const greeting = await repositories.agentMessageRepository.findOneOrFail({
        where: { sessionId, role: "assistant" },
      })
      expect(greeting.agentSettingsId).toBe(campaignVersion.id)
      expect(greeting.content).toBe("Hello from the campaign's version")
    })

    it("refuses an extraction agent (422)", async () => {
      await seedActiveCampaignWithTester({ agentType: "extraction" })

      expectResponse(await startSession(), 422)
    })
  })

  describe("getSessions", () => {
    it("lists the sessions of the campaign with their feedback status", async () => {
      await seedActiveCampaignWithTester()
      const pendingSessionId = await startSessionId()
      const submittedSessionId = await startSessionId()
      expectResponse(
        await createFeedback(submittedSessionId, { overallRating: 4, comment: null, answers: [] }),
        201,
      )

      const response = await getSessions()

      expectSchemaResponse(EvalTesterRoutes.getSessions, response, 200)
      const statusById = new Map(
        response.body.data.sessions.map((session) => [session.id, session.feedbackStatus]),
      )
      expect(statusById).toEqual(
        new Map([
          [submittedSessionId, "submitted"],
          [pendingSessionId, "pending"],
        ]),
      )
    })

    it("carries the forms the agent filled in during each session", async () => {
      const { organization, project, agent, agentSettings } = await seedActiveCampaignWithTester({
        agentSettings: {
          fillFormEnabled: true,
          outputJsonSchema: {
            type: "object",
            properties: { title: { type: "string" }, summary: { type: "string" } },
          },
        },
      })
      const sessionId = await startSessionId()
      const form = await repositories.conversationFormRepository.save(
        conversationFormFactory
          .transient({ organization, project, agent, agentSettings, session: { id: sessionId } })
          .build({ state: { title: "Session note", summary: "Filled by the agent" } }),
      )

      const response = await getSessions()

      expectSchemaResponse(EvalTesterRoutes.getSessions, response, 200)
      const [session] = response.body.data.sessions
      expect(session).toMatchObject({ id: sessionId, agentId: agent.id, feedbackStatus: "pending" })
      expect(session?.forms).toStrictEqual([
        {
          agentId: agent.id,
          status: form.status,
          state: { title: "Session note", summary: "Filled by the agent" },
          updatedAt: form.updatedAt.getTime(),
        },
      ])
    })
  })

  describe("createFeedback", () => {
    it("saves the tester's feedback, once", async () => {
      await seedActiveCampaignWithTester()
      const sessionId = await startSessionId()

      const response = await createFeedback(sessionId, {
        overallRating: 4,
        comment: "  Solid experience  ",
        answers: [{ questionId: "q1", value: 4 }],
      })

      expectSchemaResponse(EvalTesterRoutes.createFeedback, response, 201)
      expect(response.body.data).toStrictEqual({
        id: expect.any(String),
        sessionId,
        overallRating: 4,
        comment: "Solid experience",
        answers: [{ questionId: "q1", value: 4 }],
      })

      expectResponse(
        await createFeedback(sessionId, { overallRating: 3, comment: null, answers: [] }),
        409,
      )
    })

    // The old route took a partial body and answered 422 for a rating outside 1 to 5.
    it.each([
      ["a rating of 0", { overallRating: 0, comment: null, answers: [] }],
      ["a rating that is not an integer", { overallRating: 3.5, comment: null, answers: [] }],
      ["a missing comment", { overallRating: 4, answers: [] }],
      ["a missing list of answers", { overallRating: 4, comment: null }],
    ])("answers 400 for %s", async (_case, payload) => {
      await seedActiveCampaignWithTester()
      const sessionId = await startSessionId()

      expectResponse(await createFeedback(sessionId, payload), 400)
      expect(await repositories.testerSessionFeedbackRepository.count()).toBe(0)
    })
  })

  describe("the survey", () => {
    it("is null until the tester fills it, then holds it", async () => {
      await seedActiveCampaignWithTester()

      const before = await getSurvey()
      expectSchemaResponse(EvalTesterRoutes.getSurvey, before, 200)
      expect(before.body.data.survey).toBeNull()

      const created = await createSurvey({ overallRating: 5, comment: "Excellent", answers: [] })
      expectSchemaResponse(EvalTesterRoutes.createSurvey, created, 201)

      const after = await getSurvey()
      expectSchemaResponse(EvalTesterRoutes.getSurvey, after, 200)
      expect(after.body.data.survey).toStrictEqual({
        id: created.body.data.id,
        overallRating: 5,
        comment: "Excellent",
        answers: [],
      })
    })

    it("is filled once, then updated", async () => {
      await seedActiveCampaignWithTester()
      expectResponse(
        await createSurvey({ overallRating: 4, comment: "Would recommend", answers: [] }),
        201,
      )

      expectResponse(await createSurvey({ overallRating: 3, comment: null, answers: [] }), 409)

      const update = await updateSurvey({
        overallRating: 5,
        comment: "Even more so",
        answers: [{ questionId: "s1", value: 5 }],
      })
      expectSchemaResponse(EvalTesterRoutes.updateSurvey, update, 200)
      expect(update.body.data).toMatchObject({
        overallRating: 5,
        comment: "Even more so",
        answers: [{ questionId: "s1", value: 5 }],
      })
    })

    it("answers 404 for an update before the survey is filled", async () => {
      await seedActiveCampaignWithTester()

      expectResponse(await updateSurvey({ overallRating: 5, comment: null, answers: [] }), 404)
    })

    // The old route took any of the three fields alone.
    it("answers 400 for a partial update", async () => {
      await seedActiveCampaignWithTester()
      expectResponse(await createSurvey({ overallRating: 4, comment: null, answers: [] }), 201)

      expectResponse(await updateSurvey({ comment: "Even more so" }), 400)
    })
  })

  describe("deleteSession", () => {
    it("deletes a session with no feedback, which leaves the list", async () => {
      await seedActiveCampaignWithTester()
      const sessionId = await startSessionId()

      const response = await deleteSession(sessionId)

      expectSchemaResponse(EvalTesterRoutes.deleteSession, response, 200)
      expect(response.body.data).toStrictEqual({ success: true })
      const list = await getSessions()
      expect(list.body.data.sessions).toEqual([])
    })

    it("refuses to delete a session that has feedback (409)", async () => {
      await seedActiveCampaignWithTester()
      const sessionId = await startSessionId()
      expectResponse(
        await createFeedback(sessionId, { overallRating: 4, comment: null, answers: [] }),
        201,
      )

      expectResponse(await deleteSession(sessionId), 409)
      expect(
        await repositories.conversationAgentSessionRepository.count({ where: { id: sessionId } }),
      ).toBe(1)
    })
  })
})
