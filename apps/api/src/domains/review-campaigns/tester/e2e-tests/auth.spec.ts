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
import { agentFactory } from "@/domains/agents/agent.factory"
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "../../memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "../../review-campaign.factory"
import { ReviewCampaignsModule } from "../../review-campaigns.module"

const mockInvitationSender = {
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-tester-auth" }),
}

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
    organizationId = randomUUID()
    projectId = randomUUID()
    reviewCampaignId = randomUUID()
    sessionId = randomUUID()
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const seedAsTester = async (campaignStatus: "draft" | "active" | "closed" = "active") => {
    const { organization, project, user } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    const factory =
      campaignStatus === "active"
        ? reviewCampaignFactory.active()
        : campaignStatus === "closed"
          ? reviewCampaignFactory.closed()
          : reviewCampaignFactory
    const campaign = await repositories.reviewCampaignRepository.save(
      factory.transient({ organization, project, agent }).build(),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .tester()
        .accepted()
        .transient({ organization, project, campaign, user })
        .build(),
    })
    organizationId = organization.id
    projectId = project.id
    reviewCampaignId = campaign.id
    return { organization, project, user, campaign }
  }

  const seedAsNonMember = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories, {
      user: { auth0Id },
    })
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory.active().transient({ organization, project, agent }).build(),
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
      expectResponse(await subject(), 403)
    })
    it("forbids testers when campaign is draft (403)", async () => {
      await seedAsTester("draft")
      expectResponse(await subject(), 403)
    })

    // Reviewers reuse this endpoint to fetch the campaign metadata for their
    // landing page (see ReviewerCampaignLandingPage). Earlier versions only
    // allowed testers, which 403'd reviewer-only users.
    it("allows a reviewer-only member on an active campaign (200)", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories, {
        user: { auth0Id },
      })
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory.active().transient({ organization, project, agent }).build(),
      )
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .reviewer()
          .accepted()
          .transient({ organization, project, campaign, user })
          .build(),
      })
      organizationId = organization.id
      projectId = project.id
      reviewCampaignId = campaign.id
      expectResponse(await subject(), 200)
    })

    it("allows a reviewer on a closed campaign (read access stays for closed)", async () => {
      const { organization, project, user } = await createOrganizationWithProject(repositories, {
        user: { auth0Id },
      })
      const agent = agentFactory.transient({ organization, project }).build()
      await repositories.agentRepository.save(agent)
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory.closed().transient({ organization, project, agent }).build(),
      )
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .reviewer()
          .accepted()
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
        request: { payload: { type: "live" } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids non-members (403)", async () => {
      await seedAsNonMember()
      expectResponse(await subject(), 403)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 403)
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
      expectResponse(await subject(), 403)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 403)
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
      expectResponse(await subject(), 403)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 403)
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
      expectResponse(await subject(), 403)
    })
    it("forbids closed campaigns (403)", async () => {
      await seedAsTester("closed")
      expectResponse(await subject(), 403)
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
  })
})
