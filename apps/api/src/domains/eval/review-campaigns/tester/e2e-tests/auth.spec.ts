import { randomUUID } from "node:crypto"
import { EvalTesterRoutes } from "@bayes-platform/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import {
  addUserToReviewCampaign,
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import type { ReviewCampaignRoleKey } from "@/domains/review-campaigns/memberships/review-campaign-membership.types"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { reviewCampaignStatusErrorMessage } from "@/domains/review-campaigns/review-campaign-status"
import { testerCampaignSurveyFactory } from "@/domains/review-campaigns/tester-campaign-surveys/tester-campaign-survey.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

/** The routes under a campaign: the campaign comes from the path. */
const CAMPAIGN_ROUTE_NAMES = [
  "getSessions",
  "startSession",
  "getSurvey",
  "createSurvey",
  "updateSurvey",
] as const

/** The routes under a session: the campaign comes from the session. */
const SESSION_ROUTE_NAMES = ["createFeedback", "deleteSession"] as const

type RouteName = (typeof CAMPAIGN_ROUTE_NAMES)[number] | (typeof SESSION_ROUTE_NAMES)[number]

describe("Evaluation tester - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let reviewCampaignId: string = randomUUID()
  let sessionId: string = randomUUID()
  let accessToken: string | undefined = "token"
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
    organizationId = randomUUID()
    projectId = randomUUID()
    reviewCampaignId = randomUUID()
    sessionId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * Seeds a campaign of `campaignStatus` where the caller holds `roleKey` (none for a non-member),
   * a session the caller started in it and, unless `withSurvey` is false, the caller's survey.
   */
  const seedCampaign = async ({
    campaignStatus = "active",
    roleKey = "review_campaign_tester",
    withSurvey = true,
  }: {
    campaignStatus?: "draft" | "active" | "closed"
    roleKey?: ReviewCampaignRoleKey | null
    withSurvey?: boolean
  } = {}) => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject }, agent: { type: "conversation" } },
    )
    const factory =
      campaignStatus === "active"
        ? reviewCampaignFactory.active()
        : campaignStatus === "closed"
          ? reviewCampaignFactory.closed()
          : reviewCampaignFactory
    const campaign = await repositories.reviewCampaignRepository.save(
      factory.transient({ organization, project, agent, agentSettings }).build(),
    )
    if (roleKey) {
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .transient({ organization, project, campaign, user })
          .build({ roleKeys: [roleKey] }),
      })
    }
    const session = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .reviewCampaignTester()
        .build({ campaignId: campaign.id }),
    )
    if (withSurvey) {
      await repositories.testerCampaignSurveyRepository.save(
        testerCampaignSurveyFactory.transient({ organization, project, campaign, user }).build(),
      )
    }

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    sessionId = session.id
    return { organization, project, user, agent, agentSettings, campaign }
  }

  const campaignParams = () => ({ organizationId, projectId, reviewCampaignId })
  const sessionParams = () => ({ organizationId, projectId, sessionId })
  const ratedFeedback = { payload: { overallRating: 4, comment: null, answers: [] } }

  const subjects: Record<RouteName, () => ReturnType<SchemaRequester>> = {
    getSessions: () =>
      request({
        route: EvalTesterRoutes.getSessions,
        pathParams: campaignParams(),
        token: accessToken,
      }),
    startSession: () =>
      request({
        route: EvalTesterRoutes.startSession,
        pathParams: campaignParams(),
        token: accessToken,
        body: { payload: {} },
      }),
    getSurvey: () =>
      request({
        route: EvalTesterRoutes.getSurvey,
        pathParams: campaignParams(),
        token: accessToken,
      }),
    createSurvey: () =>
      request({
        route: EvalTesterRoutes.createSurvey,
        pathParams: campaignParams(),
        token: accessToken,
        body: ratedFeedback,
      }),
    updateSurvey: () =>
      request({
        route: EvalTesterRoutes.updateSurvey,
        pathParams: campaignParams(),
        token: accessToken,
        body: ratedFeedback,
      }),
    createFeedback: () =>
      request({
        route: EvalTesterRoutes.createFeedback,
        pathParams: sessionParams(),
        token: accessToken,
        body: ratedFeedback,
      }),
    deleteSession: () =>
      request({
        route: EvalTesterRoutes.deleteSession,
        pathParams: sessionParams(),
        token: accessToken,
      }),
  }

  /** The status each route answers the tester of an active campaign, with the seed above. */
  const SUCCESS_STATUS: Record<RouteName, number> = {
    getSessions: 200,
    startSession: 201,
    getSurvey: 200,
    createSurvey: 201,
    updateSurvey: 200,
    createFeedback: 201,
    deleteSession: 200,
  }

  describe.each([...CAMPAIGN_ROUTE_NAMES, ...SESSION_ROUTE_NAMES])("%s", (routeName) => {
    const subject = () => subjects[routeName]()

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for a project id that is not a UUID", async () => {
      await seedCampaign()
      projectId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown project", async () => {
      await seedCampaign()
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("forbids closed campaigns (403)", async () => {
      await seedCampaign({ campaignStatus: "closed" })
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
    })

    it("forbids a reviewer-only member (403)", async () => {
      await seedCampaign({ roleKey: "review_campaign_reviewer" })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("allows the tester of an active campaign", async () => {
      await seedCampaign({ withSurvey: routeName !== "createSurvey" })
      expectResponse(await subject(), SUCCESS_STATUS[routeName])
    })
  })

  describe.each(CAMPAIGN_ROUTE_NAMES)("%s, on a campaign", (routeName) => {
    const subject = () => subjects[routeName]()

    it("answers 400 for a campaign id that is not a UUID", async () => {
      await seedCampaign()
      reviewCampaignId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown campaign", async () => {
      await seedCampaign()
      reviewCampaignId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("forbids non-members (403)", async () => {
      await seedCampaign({ roleKey: null })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe.each(SESSION_ROUTE_NAMES)("%s, on a session", (routeName) => {
    const subject = () => subjects[routeName]()

    it("answers 400 for a session id that is not a UUID", async () => {
      await seedCampaign()
      sessionId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown session", async () => {
      await seedCampaign()
      sessionId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 422 for a session that belongs to no campaign, as today", async () => {
      const { organization, project, user, agent } = await seedCampaign()
      const session = await repositories.conversationAgentSessionRepository.save(
        conversationAgentSessionFactory.transient({ organization, project, agent, user }).build(),
      )
      sessionId = session.id
      expectResponse(await subject(), 422)
    })

    it("forbids non-members (403)", async () => {
      await seedCampaign({ roleKey: null })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    // A tester acts on their own sessions only: another tester's session answers as if absent.
    it("answers 404 for another tester's session of the campaign", async () => {
      const { organization, project, campaign } = await seedCampaign()
      const otherTesterAuthSubject = `oidc|${randomUUID()}`
      await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        user: {
          authSubject: otherTesterAuthSubject,
          email: mockOidcEmailForSub(otherTesterAuthSubject),
        },
      })
      authSubject = otherTesterAuthSubject

      expectResponse(await subject(), 404)
      expect(
        await repositories.conversationAgentSessionRepository.count({ where: { id: sessionId } }),
      ).toBe(1)
      expect(
        await repositories.testerSessionFeedbackRepository.count({ where: { sessionId } }),
      ).toBe(0)
    })
  })

  // Accepting a campaign invitation gives no project row: the campaign role is enough.
  describe("a tester who holds no project role", () => {
    const seedAsCampaignOnlyTester = async () => {
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        { agent: { type: "conversation" } },
      )
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        roleKeys: ["review_campaign_tester"],
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      organizationId = organization.id
      projectId = project.id
      reviewCampaignId = campaign.id
    }

    it("starts a session, lists it, gives feedback on it and fills the survey", async () => {
      await seedAsCampaignOnlyTester()

      const startResponse = await request({
        route: EvalTesterRoutes.startSession,
        pathParams: campaignParams(),
        token: accessToken,
        body: { payload: {} },
      })
      expectResponse(startResponse, 201)
      sessionId = startResponse.body.data.id

      const listResponse = await request({
        route: EvalTesterRoutes.getSessions,
        pathParams: campaignParams(),
        token: accessToken,
      })
      expectResponse(listResponse, 200)
      expect(listResponse.body.data.sessions.map((session) => session.id)).toEqual([sessionId])

      expectResponse(await subjects.createFeedback(), 201)
      expectResponse(await subjects.createSurvey(), 201)
    })
  })
})
