import { randomUUID } from "node:crypto"
import {
  AgentSessionMessagesRoutes,
  type BaseAgentSessionTypeDto,
  type ConversationAgentSessionTypeDto,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
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
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithAgentSession,
} from "@/domains/organizations/organization.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { RoleGrant } from "@/domains/rbac/role-grant.entity"
import {
  addUserToReviewCampaign,
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { reviewCampaignStatusErrorMessage } from "@/domains/review-campaigns/review-campaign-status"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../../test/request"
import { StreamingModule } from "../streaming.module"

describe("Agent Session Messages - stream - Auth", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let agentSessionId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [StreamingModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    agentId = randomUUID()
    agentSessionId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  // Seeds an organization/project (membership at `role`) + conversation agent, and a session of
  // `type` owned by the caller.
  const createContextForRole = async (
    role: ProjectRoleKey,
    type: BaseAgentSessionTypeDto = "live",
  ) => {
    const { organization, project, agent, agentSession, user } =
      await createOrganizationWithAgentSession({
        repositories,
        params: {
          user: { authSubject, email: mockOidcEmailForSub(authSubject) },
          projectMembership: { roleKeys: [role] },
          agentSession: { type },
        },
        agentType: "conversation",
      })

    authSubject = user.authSubject!
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    accessToken = "token"
    return { organization, project, agent, type }
  }

  /**
   * Switches the caller to an organization admin who holds no role on the project, and points the
   * path at a session of their own, so only the permission check stands between them and the route.
   */
  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
    project,
    agent,
    type,
  }: Awaited<ReturnType<typeof createContextForRole>>) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    const { user } = await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { roleKeys: ["org_admin"] },
    })
    const agentSession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .build({ type })
    await repositories.conversationAgentSessionRepository.save(agentSession)
    authSubject = organizationAdminAuthSubject
    agentSessionId = agentSession.id
  }

  /** The stream is a POST: its payload travels in the body. */
  const subject = (type: ConversationAgentSessionTypeDto) => {
    const path = AgentSessionMessagesRoutes[type].stream.getPath(
      removeNullish({ organizationId, projectId, agentId, agentSessionId }),
    )
    const req = request(app.getHttpServer())
      .post(path)
      .send({ payload: { content: "Hello" } })
      .set("Connection", "close")
    if (accessToken) req.set("Authorization", `Bearer ${accessToken}`)
    return req
  }

  const countSessionMessages = () =>
    repositories.agentMessageRepository.count({ where: { sessionId: agentSessionId ?? "" } })

  const expectStreamed = async (response: request.Response) => {
    expect(response.status).toBe(200)
    expect(response.text).not.toContain("event: error")
    expect(await countSessionMessages()).toBeGreaterThan(0)
  }

  // The handler's own checks answer HTTP 200 with an SSE error frame: only guards set a status.
  const expectTurnedAway = async (response: request.Response) => {
    expect(response.status).toBe(200)
    expect(response.text).toContain("event: error")
    expect(response.text).toContain("data: Not Found")
    expect(await countSessionMessages()).toBe(0)
  }

  describe.each([["live"], ["playground"]] as const)("on the %s route", (type) => {
    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(type), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires a valid organization ID", async () => {
      await createContextForRole("project_owner", type)
      organizationId = null
      expectResponse(await subject(type), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })

    it("requires a valid agent ID", async () => {
      await createContextForRole("project_owner", type)
      agentId = null
      expectResponse(await subject(type), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner", type)
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(type), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("answers 404 for an unknown session", async () => {
      await createContextForRole("project_owner", type)
      agentSessionId = randomUUID()
      expectResponse(await subject(type), 404)
    })

    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner", type)
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  // The live route is open to every project role, the playground route to owners and admins only.
  it.each([
    ["project_owner"],
    ["project_admin"],
    ["project_member"],
  ] as const)("lets a %s stream on the live route", async (role) => {
    await createContextForRole(role, "live")
    await expectStreamed(await subject("live"))
  })

  it.each([
    ["project_owner"],
    ["project_admin"],
  ] as const)("lets a %s stream on the playground route", async (role) => {
    await createContextForRole(role, "playground")
    await expectStreamed(await subject("playground"))
  })

  it("forbids a plain member on the playground route", async () => {
    await createContextForRole("project_member", "playground")
    expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("turns away a playground session on the live route", async () => {
    await createContextForRole("project_owner", "playground")
    await expectTurnedAway(await subject("live"))
  })

  it("turns away a live session on the playground route", async () => {
    await createContextForRole("project_owner", "live")
    await expectTurnedAway(await subject("playground"))
  })

  // The tester route checks the tester's key on the campaign of the session, which must be active.
  describe("on the review campaign tester route", () => {
    const createTesterContext = async () => {
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
      const testerAuthSubject = `oidc|${randomUUID()}`
      const { user } = await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        user: { authSubject: testerAuthSubject, email: mockOidcEmailForSub(testerAuthSubject) },
      })
      const agentSession = conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .reviewCampaignTester()
        .build({ campaignId: campaign.id })
      await repositories.conversationAgentSessionRepository.save(agentSession)

      authSubject = testerAuthSubject
      organizationId = organization.id
      projectId = project.id
      agentId = agent.id
      agentSessionId = agentSession.id
      return { organization, project, agent, agentSettings, campaign, user }
    }

    type TesterContext = Awaited<ReturnType<typeof createTesterContext>>

    /** Makes the caller a tester of a second, active campaign of the same project. */
    const joinAnotherActiveCampaign = async ({
      organization,
      project,
      agent,
      agentSettings,
      user,
    }: TesterContext) => {
      const otherCampaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .transient({ organization, project, campaign: otherCampaign, user })
          .build({ roleKeys: ["review_campaign_tester"] }),
      })
    }

    const leaveCampaign = ({ campaign, user }: TesterContext) =>
      setup.dataSource
        .getRepository(RoleGrant)
        .softDelete({ userId: user.id, resourceType: "review_campaign", resourceId: campaign.id })

    const closeCampaign = ({ campaign }: TesterContext) =>
      repositories.reviewCampaignRepository.update(
        { id: campaign.id },
        { status: "closed", closedAt: new Date() },
      )

    it("lets a tester of an active campaign stream in their campaign session", async () => {
      await createTesterContext()
      await expectStreamed(await subject("review_campaign_tester"))
    })

    it("forbids the tester once the campaign is closed", async () => {
      const context = await createTesterContext()
      await closeCampaign(context)

      const response = await subject("review_campaign_tester")
      expect(response.text).toContain(reviewCampaignStatusErrorMessage("closed"))
      expect(await countSessionMessages()).toBe(0)
    })

    it("keeps the session of a closed campaign shut for a tester of another active campaign of the project", async () => {
      const context = await createTesterContext()
      await joinAnotherActiveCampaign(context)
      await closeCampaign(context)

      const response = await subject("review_campaign_tester")
      expect(response.text).toContain(reviewCampaignStatusErrorMessage("closed"))
      expect(await countSessionMessages()).toBe(0)
    })

    it("forbids someone removed from the session's campaign, even as a tester of another active campaign of the project", async () => {
      const context = await createTesterContext()
      await joinAnotherActiveCampaign(context)
      await leaveCampaign(context)

      expectResponse(
        await subject("review_campaign_tester"),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
      expect(await countSessionMessages()).toBe(0)
    })

    it("turns away a live session on the tester route", async () => {
      await createContextForRole("project_owner", "live")
      expectResponse(await subject("review_campaign_tester"), 404)
    })
  })
})
