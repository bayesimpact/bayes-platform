import { randomUUID } from "node:crypto"
import { EvalReviewerRoutes } from "@caseai-connect/eval-contracts"
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
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../../test/schema-request"
import { EvalModule } from "../../../eval.module"

describe("Evaluation reviewer - Auth", () => {
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

  const seedReviewableSession = async ({
    campaignStatus = "active",
    callerRoleKey = "review_campaign_reviewer",
  }: {
    campaignStatus?: "draft" | "active" | "closed"
    callerRoleKey?: ReviewCampaignRoleKey | null
  } = {}) => {
    const {
      organization,
      project,
      agent,
      agentSettings,
      user: caller,
    } = await createOrganizationWithAgent(repositories, {
      user: { authSubject },
      agent: { type: "conversation" },
    })
    const tester = await repositories.userRepository.save(
      userFactory.build({ email: `tester-auth-${randomUUID()}@example.com` }),
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
    if (callerRoleKey) {
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .withRoles(callerRoleKey)
          .transient({ organization, project, campaign, user: caller })
          .build(),
      })
    }
    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user: tester })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session)

    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    sessionId = session.id
  }

  const sessionParams = () => ({ organizationId, projectId, reviewCampaignId, sessionId })

  const validReview = { payload: { overallRating: 4, comment: null, answers: [] } }

  const subjects = {
    getSessions: () =>
      request({
        route: EvalReviewerRoutes.getSessions,
        pathParams: { organizationId, projectId, reviewCampaignId },
        token: accessToken,
      }),
    getSession: () =>
      request({
        route: EvalReviewerRoutes.getSession,
        pathParams: sessionParams(),
        token: accessToken,
      }),
    getSessionMcpAppHtml: () =>
      request({
        route: EvalReviewerRoutes.getSessionMcpAppHtml,
        pathParams: sessionParams(),
        token: accessToken,
      }),
    createReview: () =>
      request({
        route: EvalReviewerRoutes.createReview,
        pathParams: sessionParams(),
        token: accessToken,
        body: validReview,
      }),
    updateReview: () =>
      request({
        route: EvalReviewerRoutes.updateReview,
        pathParams: { ...sessionParams(), reviewId: randomUUID() },
        token: accessToken,
        body: validReview,
      }),
  }

  describe.each([
    "getSessions",
    "getSession",
    "getSessionMcpAppHtml",
    "createReview",
    "updateReview",
  ] as const)("%s", (routeName) => {
    const subject = subjects[routeName]
    const isRead = routeName.startsWith("get")

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("forbids tester-only members (no reviewer role) (403)", async () => {
      await seedReviewableSession({ callerRoleKey: "review_campaign_tester" })
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    if (isRead) {
      it("forbids non-members (403)", async () => {
        await seedReviewableSession({ callerRoleKey: null })
        expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      })
      it("forbids reviewers on draft campaigns (403)", async () => {
        await seedReviewableSession({ campaignStatus: "draft" })
        expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("draft"))
      })
      it("allows reviewers on closed campaigns (200)", async () => {
        await seedReviewableSession({ campaignStatus: "closed" })
        expectResponse(await subject(), 200)
      })
    } else {
      it("forbids reviewers on closed campaigns (403)", async () => {
        await seedReviewableSession({ campaignStatus: "closed" })
        expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
      })
    }
  })

  describe.each([
    "getSession",
    "getSessionMcpAppHtml",
    "createReview",
    "updateReview",
  ] as const)("%s on a session", (routeName) => {
    const subject = subjects[routeName]

    it("answers 404 for an unknown session id", async () => {
      await seedReviewableSession()
      sessionId = randomUUID()
      expectResponse(await subject(), 404)
    })
  })

  // The campaign is read from the session: the id of the path is not looked at.
  describe("a campaign id that is another UUID", () => {
    it("answers as for the right campaign id on the routes that read the session", async () => {
      await seedReviewableSession()
      reviewCampaignId = randomUUID()
      expectResponse(await subjects.getSession(), 200)
      expectResponse(await subjects.getSessionMcpAppHtml(), 200)
      expectResponse(await subjects.createReview(), 201)
    })

    it("answers 404 on the list of sessions, which loads the campaign of its path", async () => {
      await seedReviewableSession()
      reviewCampaignId = randomUUID()
      expectResponse(await subjects.getSessions(), 404)
    })
  })

  // Accepting a campaign invitation gives no project row: the campaign role is enough.
  describe("a reviewer who holds no project role", () => {
    const seedAsCampaignOnlyReviewer = async () => {
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
        roleKeys: ["review_campaign_reviewer"],
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      const tester = await repositories.userRepository.save(
        userFactory.build({ email: `tester-auth-${randomUUID()}@example.com` }),
      )
      const session = conversationAgentSessionFactory
        .transient({ organization, project, agent, user: tester })
        .build({ campaignId: campaign.id })
      await repositories.conversationAgentSessionRepository.save(session)

      organizationId = organization.id
      projectId = project.id
      reviewCampaignId = campaign.id
      sessionId = session.id
    }

    it("lists the campaign's sessions", async () => {
      await seedAsCampaignOnlyReviewer()

      const response = await subjects.getSessions()

      expectResponse(response, 200)
      expect(response.body.data.sessions.map((session) => session.sessionId)).toEqual([sessionId])
    })

    it("gets a session to review", async () => {
      await seedAsCampaignOnlyReviewer()

      const response = await subjects.getSession()

      expectResponse(response, 200)
      expect(response.body.data.sessionId).toBe(sessionId)
    })

    it("reads the HTML of the session's MCP Apps, none here", async () => {
      await seedAsCampaignOnlyReviewer()

      const response = await subjects.getSessionMcpAppHtml()

      expectResponse(response, 200)
      expect(response.body.data).toEqual([])
    })
  })
})
