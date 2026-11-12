import { randomUUID } from "node:crypto"
import {
  type BaseAgentSessionTypeDto,
  ConversationAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithAgentSession,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import type { ReviewCampaignRoleKey } from "@/domains/review-campaigns/memberships/review-campaign-membership.types"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { conversationAgentSessionFactory } from "../conversation-agent-session.factory"
import { ConversationAgentSessionsModule } from "../conversation-agent-sessions.module"

describe("Agent Sessions - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
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
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
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
  // `type` owned by the caller so the delete and sub-session routes have a resolvable target.
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

  // Shared by the four routes: authentication, organization and agent context.
  const describeContextChecks = (
    subject: (type: BaseAgentSessionTypeDto) => ReturnType<Requester>,
  ) => {
    describe.each([["live"], ["playground"]] as const)("on the %s routes", (type) => {
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

      it("forbids an organization admin who holds no project role", async () => {
        const context = await createContextForRole("project_owner", type)
        await switchToOrganizationAdminWithoutProjectRole(context)
        expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      })
    })
  }

  // Live routes are open to every project role, playground routes to owners and admins only.
  const describeRoleChecks = (
    subject: (type: BaseAgentSessionTypeDto) => ReturnType<Requester>,
  ) => {
    it.each([
      ["project_owner"],
      ["project_admin"],
      ["project_member"],
    ] as const)("allows a project %s on the live routes", async (role) => {
      await createContextForRole(role, "live")
      expectResponse(await subject("live"), 201)
    })

    it.each([
      ["project_owner"],
      ["project_admin"],
    ] as const)("allows a project %s on the playground routes", async (role) => {
      await createContextForRole(role, "playground")
      expectResponse(await subject("playground"), 201)
    })

    it("forbids a plain member on the playground routes", async () => {
      await createContextForRole("project_member", "playground")
      expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  }

  describe("createOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ConversationAgentSessionsRoutes[type].createOne,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)
  })

  describe("getAll", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ConversationAgentSessionsRoutes[type].getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)
  })

  describe("deleteOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ConversationAgentSessionsRoutes[type].deleteOne,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)

    it("answers 404 for an unknown session", async () => {
      await createContextForRole("project_owner")
      agentSessionId = randomUUID()
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a playground session on the live routes", async () => {
      await createContextForRole("project_owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a live session on the playground routes", async () => {
      await createContextForRole("project_owner", "live")
      expectResponse(await subject("playground"), 404)
    })
  })

  describe("listSubSessions", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: ConversationAgentSessionsRoutes[type].listSubSessions,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
      })

    describeContextChecks(subject)
    describeRoleChecks(subject)
  })

  // Accepting an invitation on one agent gives project_member on the project and agent_member on
  // that agent. The live routes check the agent, so the other agents of the project stay closed.
  describe("a person invited to one agent", () => {
    const createInvitedAgentMemberContext = async () => {
      const { organization, project, agent, user } = await createOrganizationWithAgent(
        repositories,
        {
          user: { authSubject, email: mockOidcEmailForSub(authSubject) },
          organizationMembership: { roleKeys: ["org_member"] },
          projectMembership: { roleKeys: ["project_member"] },
          agentMembership: { roleKeys: ["agent_member"] },
          agent: { type: "conversation" },
        },
      )
      const otherAgent = await repositories.agentRepository.save(
        agentFactory.transient({ organization, project }).build({ type: "conversation" }),
      )
      await repositories.agentSettingsRepository.save(
        agentSettingsFactory.transient({ organization, project, agent: otherAgent }).build(),
      )
      authSubject = user.authSubject!
      organizationId = organization.id
      projectId = project.id
      accessToken = "token"
      return { organization, project, agent, otherAgent }
    }

    const subject = (routeKey: "createOne" | "getAll") =>
      request({
        route: ConversationAgentSessionsRoutes.live[routeKey],
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    it.each([["createOne"], ["getAll"]] as const)("can %s on their agent", async (routeKey) => {
      const { agent } = await createInvitedAgentMemberContext()
      agentId = agent.id
      expectResponse(await subject(routeKey), 201)
    })

    it.each([
      ["createOne"],
      ["getAll"],
    ] as const)("cannot %s on another agent of the project", async (routeKey) => {
      const { otherAgent } = await createInvitedAgentMemberContext()
      agentId = otherAgent.id
      expectResponse(await subject(routeKey), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("lets a project admin open every agent of the project", async () => {
      const { organization, project, otherAgent } = await createInvitedAgentMemberContext()
      const adminAuthSubject = `oidc|${randomUUID()}`
      const { user: admin } = await addUserToOrganization({
        repositories,
        organization,
        user: { authSubject: adminAuthSubject, email: mockOidcEmailForSub(adminAuthSubject) },
        membership: { roleKeys: ["org_member"] },
      })
      await addUserToProject({
        repositories,
        project,
        user: admin,
        membership: { roleKeys: ["project_admin"] },
      })
      authSubject = adminAuthSubject
      agentId = otherAgent.id
      expectResponse(await subject("createOne"), 201)
    })
  })

  // A campaign role gives the session keys on the campaign's project only, for the tester routes.
  // The live routes check the agent, where a campaign role gives nothing.
  describe("review campaign participants", () => {
    const createCampaignParticipantContext = async ({
      roleKey = "review_campaign_tester",
    }: {
      roleKey?: ReviewCampaignRoleKey
    } = {}) => {
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
      const participantAuthSubject = `oidc|${randomUUID()}`
      const { user } = await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        roleKeys: [roleKey],
        user: {
          authSubject: participantAuthSubject,
          email: mockOidcEmailForSub(participantAuthSubject),
        },
      })
      authSubject = participantAuthSubject
      organizationId = organization.id
      projectId = project.id
      agentId = agent.id
      accessToken = "token"
      return { organization, project, agent, campaign, user }
    }

    const subject = (routeKey: "createOne" | "getAll", type: BaseAgentSessionTypeDto) =>
      request({
        route: ConversationAgentSessionsRoutes[type][routeKey],
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    it.each([
      ["createOne", "live"],
      ["getAll", "live"],
      ["createOne", "playground"],
      ["getAll", "playground"],
    ] as const)("forbids a tester of an active campaign to %s on the %s routes of the campaign's agent", async (routeKey, type) => {
      await createCampaignParticipantContext()
      expectResponse(await subject(routeKey, type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each([
      ["createOne"],
      ["getAll"],
    ] as const)("forbids a reviewer to %s on the live routes", async (routeKey) => {
      await createCampaignParticipantContext({ roleKey: "review_campaign_reviewer" })
      expectResponse(await subject(routeKey, "live"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("forbids a tester to delete their own live session", async () => {
      const { organization, project, agent, campaign, user } =
        await createCampaignParticipantContext()
      const agentSession = conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .live()
        .build({ campaignId: campaign.id })
      await repositories.conversationAgentSessionRepository.save(agentSession)
      agentSessionId = agentSession.id

      expectResponse(
        await request({
          route: ConversationAgentSessionsRoutes.live.deleteOne,
          pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
          token: accessToken ?? undefined,
        }),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })
  })
})
