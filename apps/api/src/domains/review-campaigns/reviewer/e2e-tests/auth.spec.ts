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
import { INVITATION_SENDER } from "@/domains/auth/invitation-sender.interface"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
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
  sendInvitation: jest.fn().mockResolvedValue({ ticketId: "ticket-reviewer-auth" }),
}

describe("ReviewCampaigns - Reviewer auth", () => {
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

  const seedReviewableSession = async ({
    campaignStatus = "active",
    callerRole = "reviewer",
  }: {
    campaignStatus?: "draft" | "active" | "closed"
    callerRole?: "reviewer" | "tester" | "none"
  } = {}) => {
    const {
      organization,
      project,
      agent,
      agentSettings,
      user: caller,
    } = await createOrganizationWithAgent(repositories, {
      user: { auth0Id },
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
    if (callerRole !== "none") {
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory[callerRole]()
          .accepted()
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

  describe("submitReviewerSessionReview", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.submitReviewerSessionReview,
        pathParams: removeNullish({ organizationId, projectId, reviewCampaignId, sessionId }),
        token: accessToken ?? undefined,
        request: { payload: { overallRating: 4 } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("forbids non-members (403)", async () => {
      await seedReviewableSession({ callerRole: "none" })
      expectResponse(await subject(), 403)
    })
    it("forbids tester-only members (no reviewer role) (403)", async () => {
      await seedReviewableSession({ callerRole: "tester" })
      expectResponse(await subject(), 403)
    })
    it("forbids reviewers on closed campaigns (403)", async () => {
      await seedReviewableSession({ campaignStatus: "closed" })
      expectResponse(await subject(), 403)
    })
  })

  describe("updateReviewerSessionReview", () => {
    const subject = async () =>
      request({
        route: ReviewCampaignsRoutes.updateReviewerSessionReview,
        pathParams: removeNullish({
          organizationId,
          projectId,
          reviewCampaignId,
          sessionId,
          reviewId: randomUUID(),
        }),
        token: accessToken ?? undefined,
        request: { payload: { overallRating: 4 } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })
    it("returns 404 when session not found", async () => {
      await seedReviewableSession()
      sessionId = randomUUID()
      expectResponse(await subject(), 404)
    })
  })
})
