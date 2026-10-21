import { randomUUID } from "node:crypto"
import { ReviewCampaignsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import {
  addUserToReviewCampaign,
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "../../memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "../../review-campaign.factory"
import { reviewCampaignStatusErrorMessage } from "../../review-campaign-status"
import { ReviewCampaignsModule } from "../../review-campaigns.module"
import type { ReviewCampaignMembershipRole } from "../../review-campaigns.types"

describe("ReviewCampaigns - Tester auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let reviewCampaignId: string | null = randomUUID()
  let sessionId: string = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ReviewCampaignsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
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

  const seedAsTester = async (
    campaignStatus: "draft" | "active" | "closed" = "active",
    role: ReviewCampaignMembershipRole = "tester",
  ) => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
        agent: { type: "conversation" },
      },
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
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .transient({ organization, project, campaign, user })
        .build({ role }),
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, user, agent, campaign }
  }

  const seedAsReviewerOnly = (campaignStatus: "draft" | "active" | "closed" = "active") =>
    seedAsTester(campaignStatus, "reviewer")

  // A campaign session started by the caller, for the routes nested under a session.
  const seedOwnSession = async ({
    organization,
    project,
    user,
    agent,
    campaign,
  }: Awaited<ReturnType<typeof seedAsTester>>) => {
    const session = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .build({ campaignId: campaign.id })
    await repositories.conversationAgentSessionRepository.save(session)
    sessionId = session.id
  }

  // A campaign row written before campaign roles: the legacy role column and no role_id.
  const seedAsTesterWithoutCampaignRole = async () => {
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { user: { authSubject } },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    await repositories.userMembershipRepository.save(
      userMembershipFactory.build({
        userId: user.id,
        resourceType: "review_campaign",
        resourceId: campaign.id,
        roleId: null,
      }),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
  }

  const seedAsNonMember = async () => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        user: { authSubject },
      },
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build(),
    )
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, campaign }
  }

  describe("getMyReviewCampaigns", () => {
    it("requires an authentication token", async () => {
      accessToken = null
      const response = await request({
        route: ReviewCampaignsRoutes.getMyReviewCampaigns,
        token: accessToken ?? undefined,
      })
      expectResponse(response, 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
  })

  describe("getTesterContext", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.getTesterContext,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids non-members of the campaign (403)", async () => {
      await seedAsNonMember()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids testers when campaign is draft (403)", async () => {
      await seedAsTester("draft")
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("draft"))
    })
    it("forbids a campaign row without a campaign role (403)", async () => {
      await seedAsTesterWithoutCampaignRole()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    // The context is neutral metadata, and the rule only depends on the campaign status.
    it("allows a tester on a closed campaign (200)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 200)
    })

    // Reviewers reuse this endpoint to fetch the campaign metadata for their
    // landing page (see ReviewerCampaignLandingPage). Earlier versions only
    // allowed testers, which 403'd reviewer-only users.
    it("allows a reviewer-only member on an active campaign (200)", async () => {
      const { organization, project, user, agent, agentSettings } =
        await createOrganizationWithAgent(repositories, {
          user: { authSubject },
        })
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .reviewer()
          .transient({ organization, project, campaign, user })
          .build(),
      })
      organizationId = organization.id
      projectId = project.id
      reviewCampaignId = campaign.id
      expectResponse(await subject(), 200)
    })

    it("allows a reviewer on a closed campaign (read access stays for closed)", async () => {
      const { organization, project, user, agent, agentSettings } =
        await createOrganizationWithAgent(repositories, {
          user: { authSubject },
        })
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .closed()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .reviewer()
          .transient({ organization, project, campaign, user })
          .build(),
      })
      organizationId = organization.id
      projectId = project.id
      reviewCampaignId = campaign.id
      expectResponse(await subject(), 200)
    })
  })

  describe("startTesterSession", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.startTesterSession,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
        token: accessToken ?? undefined,
        request: { payload: {} },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids non-members (403)", async () => {
      await seedAsNonMember()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
    })
    it("forbids a reviewer-only member (403)", async () => {
      await seedAsReviewerOnly()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids a campaign row without a campaign role (403)", async () => {
      await seedAsTesterWithoutCampaignRole()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("listMyTesterSessions", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.listMyTesterSessions,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids non-members (403)", async () => {
      await seedAsNonMember()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
    })
    it("forbids a reviewer-only member (403)", async () => {
      await seedAsReviewerOnly()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("submitTesterFeedback", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.submitTesterFeedback,
        pathParams: removeNullish({ organizationId, projectId, sessionId }),
        token: accessToken ?? undefined,
        request: { payload: { overallRating: 4 } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("returns 404 when session not found", async () => {
      await seedAsTester()
      sessionId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedOwnSession(await seedAsTester("closed"))
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
    })
    it("forbids a reviewer-only member (403)", async () => {
      await seedOwnSession(await seedAsReviewerOnly())
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("allows the tester of an active campaign (201)", async () => {
      await seedOwnSession(await seedAsTester())
      expectResponse(await subject(), 201)
    })
  })

  describe("updateTesterFeedback", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.updateTesterFeedback,
        pathParams: removeNullish({ organizationId, projectId, sessionId }),
        token: accessToken ?? undefined,
        request: { payload: { overallRating: 5 } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedOwnSession(await seedAsTester("closed"))
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
    })
    it("forbids a reviewer-only member (403)", async () => {
      await seedOwnSession(await seedAsReviewerOnly())
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("submitTesterSurvey", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.submitTesterSurvey,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
        token: accessToken ?? undefined,
        request: { payload: { overallRating: 4 } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids non-members (403)", async () => {
      await seedAsNonMember()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
    })
    it("forbids a reviewer-only member (403)", async () => {
      await seedAsReviewerOnly()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("updateTesterSurvey", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.updateTesterSurvey,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
        token: accessToken ?? undefined,
        request: { payload: { overallRating: 5 } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids non-members (403)", async () => {
      await seedAsNonMember()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
    })
    it("forbids a reviewer-only member (403)", async () => {
      await seedAsReviewerOnly()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("getMyTesterSurvey", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.getMyTesterSurvey,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids non-members (403)", async () => {
      await seedAsNonMember()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
    })
    it("forbids a reviewer-only member (403)", async () => {
      await seedAsReviewerOnly()
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  describe("deleteTesterSession", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.deleteTesterSession,
        pathParams: removeNullish({ organizationId, projectId, sessionId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("returns 404 when session not found", async () => {
      await seedAsTester()
      sessionId = randomUUID()
      expectResponse(await subject(), 404)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedOwnSession(await seedAsTester("closed"))
      expectResponse(await subject(), 403, reviewCampaignStatusErrorMessage("closed"))
    })
    it("forbids a reviewer-only member (403)", async () => {
      await seedOwnSession(await seedAsReviewerOnly())
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
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
        role: "tester",
        user: { authSubject, email: mockOidcEmailForSub(authSubject) },
      })
      organizationId = organization.id
      projectId = project.id
      reviewCampaignId = campaign.id
    }

    const pathParams = () => removeNullish({ organizationId, projectId, reviewCampaignId })

    it("gets the tester context of an active campaign", async () => {
      await seedAsCampaignOnlyTester()
      expectResponse(
        await request({
          route: ReviewCampaignsRoutes.getTesterContext,
          pathParams: pathParams(),
          token: accessToken ?? undefined,
        }),
        200,
      )
    })

    it("starts a session and lists it", async () => {
      await seedAsCampaignOnlyTester()

      const startResponse = await request({
        route: ReviewCampaignsRoutes.startTesterSession,
        pathParams: pathParams(),
        token: accessToken ?? undefined,
        request: { payload: {} },
      })
      expectResponse(startResponse, 201)

      const listResponse = await request({
        route: ReviewCampaignsRoutes.listMyTesterSessions,
        pathParams: pathParams(),
        token: accessToken ?? undefined,
      })
      expectResponse(listResponse, 200)
      expect(listResponse.body.data.sessions.map((session) => session.id)).toEqual([
        startResponse.body.data.id,
      ])
    })
  })
})
