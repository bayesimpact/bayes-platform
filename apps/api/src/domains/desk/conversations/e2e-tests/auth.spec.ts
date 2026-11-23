import { randomUUID } from "node:crypto"
import { DeskAgentSessionsRoutes, DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import supertest from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMessageAttachmentDocumentFactory } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-document.factory"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithAgentMessage,
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
import { expectResponse } from "../../../../../test/request"
import { type SchemaRequester, testSchemaRequester } from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

/** The routes of a conversation agent, checked with `agent.conversation.session.*` on the agent. */
type AgentRouteName =
  | "getConversations"
  | "createOne"
  | "deleteOne"
  | "getMessages"
  | "getMcpAppsHtml"
  | "presignAttachment"
  | "getAttachmentUrl"
  | "streamReply"

const AGENT_ROUTE_NAMES: AgentRouteName[] = [
  "getConversations",
  "createOne",
  "deleteOne",
  "getMessages",
  "getMcpAppsHtml",
  "presignAttachment",
  "getAttachmentUrl",
  "streamReply",
]

/** The routes that name a conversation, and so resolve the `agentSession` context. */
const SESSION_ROUTE_NAMES: AgentRouteName[] = [
  "deleteOne",
  "getMessages",
  "getMcpAppsHtml",
  "presignAttachment",
  "getAttachmentUrl",
]

describe("Desk conversations - Auth", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string = randomUUID()
  let projectId: string = randomUUID()
  let agentId: string = randomUUID()
  let agentSessionId: string = randomUUID()
  let agentMessageId: string = randomUUID()
  let attachmentDocumentId: string = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    agentId = randomUUID()
    agentSessionId = randomUUID()
    agentMessageId = randomUUID()
    attachmentDocumentId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /**
   * Seeds a project (membership at `role`) with a conversation agent, a conversation of `type`
   * owned by the caller with one message, and an attachment that message carries, so every route
   * has a target.
   */
  const createContextForRole = async (
    role: ProjectRoleKey,
    type: "live" | "playground" = "live",
  ) => {
    const { organization, project, agent, agentSession, agentMessage, user } =
      await createOrganizationWithAgentMessage({
        repositories,
        params: {
          user: { authSubject, email: mockOidcEmailForSub(authSubject) },
          projectMembership: { roleKeys: [role] },
          agentSession: { type },
        },
        agentType: "conversation",
      })
    const attachmentDocument = await repositories.agentMessageAttachmentDocumentRepository.save(
      agentMessageAttachmentDocumentFactory.transient({ organization, project }).build(),
    )
    await repositories.agentMessageRepository.update(
      { id: agentMessage.id },
      { attachmentDocumentId: attachmentDocument.id },
    )

    authSubject = user.authSubject!
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    agentMessageId = agentMessage.id
    attachmentDocumentId = attachmentDocument.id
    return { organization, project, agent, type }
  }

  /**
   * Switches the caller to an organization admin who holds no role on the project, and points the
   * path at a conversation of their own, so only the permission check stands in the way.
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
    const agentSession = await repositories.conversationAgentSessionRepository.save(
      conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .build({ type }),
    )
    authSubject = organizationAdminAuthSubject
    agentSessionId = agentSession.id
  }

  /**
   * Switches the caller to another owner of the same project, and leaves the path on the first
   * person's live conversation.
   */
  const switchToAnotherProjectOwner = async ({
    organization,
    project,
  }: Awaited<ReturnType<typeof createContextForRole>>) => {
    const otherAuthSubject = `oidc|${randomUUID()}`
    const { user } = await addUserToOrganization({
      repositories,
      organization,
      user: { authSubject: otherAuthSubject, email: mockOidcEmailForSub(otherAuthSubject) },
      membership: { roleKeys: ["org_member"] },
    })
    await addUserToProject({
      repositories,
      project,
      user,
      membership: { roleKeys: ["project_owner"] },
    })
    authSubject = otherAuthSubject
  }

  const agentParams = () => ({ organizationId, projectId, agentId })
  const conversationParams = () => ({ ...agentParams(), agentSessionId })

  /** The stream is not a schema route: its URL comes from the route, the request from supertest. */
  const streamReply = () => {
    const pending = supertest(app.getHttpServer())
      .post(DeskConversationsRoutes.streamReply.getPath(conversationParams()))
      .send({ payload: { content: "Hello" } })
      .set("Connection", "close")
    if (accessToken) pending.set("Authorization", `Bearer ${accessToken}`)
    return pending
  }

  const subjects: Record<AgentRouteName, () => Promise<supertest.Response>> = {
    getConversations: () =>
      request({
        route: DeskAgentSessionsRoutes.getConversations,
        pathParams: agentParams(),
        token: accessToken,
      }),
    createOne: () =>
      request({
        route: DeskConversationsRoutes.createOne,
        pathParams: agentParams(),
        token: accessToken,
        body: { payload: {} },
      }),
    deleteOne: () =>
      request({
        route: DeskConversationsRoutes.deleteOne,
        pathParams: conversationParams(),
        token: accessToken,
      }),
    getMessages: () =>
      request({
        route: DeskConversationsRoutes.getMessages,
        pathParams: conversationParams(),
        token: accessToken,
      }),
    getMcpAppsHtml: () =>
      request({
        route: DeskConversationsRoutes.getMcpAppsHtml,
        pathParams: conversationParams(),
        token: accessToken,
      }),
    presignAttachment: () =>
      request({
        route: DeskConversationsRoutes.presignAttachment,
        pathParams: conversationParams(),
        token: accessToken,
        body: { payload: { fileName: "notes.pdf", mimeType: "application/pdf", size: 1234 } },
      }),
    getAttachmentUrl: () =>
      request({
        route: DeskConversationsRoutes.getAttachmentUrl,
        pathParams: { ...conversationParams(), attachmentDocumentId },
        token: accessToken,
      }),
    streamReply,
  }

  const countSessionMessages = () =>
    repositories.agentMessageRepository.count({ where: { sessionId: agentSessionId } })

  /** Every route answers 201 (a POST), the stream 200 with no error frame. */
  const expectAllowed = async (routeName: AgentRouteName) => {
    const messageCountBefore = await countSessionMessages()
    const response = await subjects[routeName]()
    if (routeName !== "streamReply") {
      expectResponse(response, 201)
      return
    }
    expect(response.status).toBe(200)
    expect(response.text).not.toContain("event: error")
    expect(await countSessionMessages()).toBeGreaterThan(messageCountBefore)
  }

  describe.each(AGENT_ROUTE_NAMES)("%s", (routeName) => {
    const subject = () => subjects[routeName]()

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for an agent id that is not a UUID", async () => {
      await createContextForRole("project_owner")
      agentId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown agent", async () => {
      await createContextForRole("project_owner")
      agentId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each<ProjectRoleKey>([
      "project_owner",
      "project_admin",
      "project_member",
    ])("allows a %s", async (role) => {
      await createContextForRole(role)
      await expectAllowed(routeName)
    })
  })

  describe.each(SESSION_ROUTE_NAMES)("%s, on a conversation", (routeName) => {
    const subject = () => subjects[routeName]()

    it("answers 400 for a conversation id that is not a UUID", async () => {
      await createContextForRole("project_owner")
      agentSessionId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown conversation", async () => {
      await createContextForRole("project_owner")
      agentSessionId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a playground session", async () => {
      await createContextForRole("project_owner", "playground")
      expectResponse(await subject(), 404)
    })

    it("answers 404 for someone else's live conversation, even to a project owner", async () => {
      const context = await createContextForRole("project_owner")
      await switchToAnotherProjectOwner(context)
      expectResponse(await subject(), 404)
    })
  })

  describe("streamReply, on a conversation", () => {
    it("answers 404 for an unknown conversation", async () => {
      await createContextForRole("project_owner")
      agentSessionId = randomUUID()
      expectResponse(await streamReply(), 404)
    })

    it("answers 404 for someone else's live conversation, even to a project owner", async () => {
      const context = await createContextForRole("project_owner")
      await switchToAnotherProjectOwner(context)
      const messageCountBefore = await countSessionMessages()

      expectResponse(await streamReply(), 404)
      expect(await countSessionMessages()).toBe(messageCountBefore)
    })

    // As on the live route, the handler's own check answers 200 with an SSE error frame: only the
    // guards set a status.
    it("turns away a playground session", async () => {
      await createContextForRole("project_owner", "playground")
      const messageCountBefore = await countSessionMessages()

      const response = await streamReply()

      expect(response.status).toBe(200)
      expect(response.text).toContain("event: error")
      expect(response.text).toContain("data: Not Found")
      expect(await countSessionMessages()).toBe(messageCountBefore)
    })
  })

  it("answers 400 for an attachment id that is not a UUID", async () => {
    await createContextForRole("project_owner")
    attachmentDocumentId = "not-a-uuid"
    expectResponse(await subjects.getAttachmentUrl(), 400)
  })

  it("records the activity of a new conversation", async () => {
    await createContextForRole("project_member")
    expectResponse(await subjects.createOne(), 201)
    await expectActivityCreated("conversationAgentSession.create")
  })

  // Accepting an invitation to one agent gives project_member on the project and agent_member on
  // that agent. The routes check the agent, so the other agents of the project stay closed.
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
        agentSettingsFactory
          .production()
          .transient({ organization, project, agent: otherAgent })
          .build(),
      )
      authSubject = user.authSubject!
      organizationId = organization.id
      projectId = project.id
      return { organization, project, agent, otherAgent }
    }

    it.each<AgentRouteName>([
      "createOne",
      "getConversations",
    ])("can %s on their agent", async (routeName) => {
      const { agent } = await createInvitedAgentMemberContext()
      agentId = agent.id
      expectResponse(await subjects[routeName](), 201)
    })

    it.each<AgentRouteName>([
      "createOne",
      "getConversations",
    ])("cannot %s on another agent of the project", async (routeName) => {
      const { otherAgent } = await createInvitedAgentMemberContext()
      agentId = otherAgent.id
      expectResponse(await subjects[routeName](), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
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
      expectResponse(await subjects.createOne(), 201)
    })
  })

  // A campaign role gives keys on the campaign's project only. These routes check the agent, where
  // a campaign role gives nothing.
  describe("review campaign participants", () => {
    const createCampaignParticipantContext = async (
      roleKey: ReviewCampaignRoleKey = "review_campaign_tester",
    ) => {
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
      const agentSession = await repositories.conversationAgentSessionRepository.save(
        conversationAgentSessionFactory
          .transient({ organization, project, agent, user })
          .live()
          .build({ campaignId: campaign.id }),
      )
      const agentMessage = await repositories.agentMessageRepository.save(
        agentMessageFactory
          .transient({ organization, project, session: agentSession, agentSettings })
          .assistant()
          .build(),
      )

      authSubject = participantAuthSubject
      organizationId = organization.id
      projectId = project.id
      agentId = agent.id
      agentSessionId = agentSession.id
      agentMessageId = agentMessage.id
      return { campaign, agentMessage }
    }

    it.each(AGENT_ROUTE_NAMES)("forbids a tester to %s", async (routeName) => {
      await createCampaignParticipantContext()
      expectResponse(await subjects[routeName](), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each<AgentRouteName>([
      "createOne",
      "getConversations",
    ])("forbids a reviewer to %s", async (routeName) => {
      await createCampaignParticipantContext("review_campaign_reviewer")
      expectResponse(await subjects[routeName](), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    // Feedback is checked on the project, where a tester's campaign gives the key: the tester
    // gives feedback in the conversations of their campaign while it is active.
    describe("createMessageFeedback", () => {
      const createFeedback = () =>
        request({
          route: DeskConversationsRoutes.createMessageFeedback,
          pathParams: { organizationId, projectId, agentMessageId },
          token: accessToken,
          body: { payload: { rating: "negative", content: "Out of date prices" } },
        })

      it("lets a tester of an active campaign give feedback", async () => {
        const { agentMessage } = await createCampaignParticipantContext()
        expectResponse(await createFeedback(), 201)
        expect(
          await repositories.agentMessageFeedbackRepository.count({
            where: { agentMessageId: agentMessage.id },
          }),
        ).toBe(1)
      })

      it("forbids the tester once the campaign is closed", async () => {
        const { campaign } = await createCampaignParticipantContext()
        await repositories.reviewCampaignRepository.update(
          { id: campaign.id },
          { status: "closed", closedAt: new Date() },
        )
        expectResponse(await createFeedback(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      })

      it("forbids a reviewer-only participant", async () => {
        await createCampaignParticipantContext("review_campaign_reviewer")
        expectResponse(await createFeedback(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      })
    })
  })

  describe("createMessageFeedback", () => {
    const subject = () =>
      request({
        route: DeskConversationsRoutes.createMessageFeedback,
        pathParams: { organizationId, projectId, agentMessageId },
        token: accessToken,
        body: { payload: { rating: "positive" } },
      })

    it("requires an authentication token", async () => {
      accessToken = undefined
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("answers 400 for a message id that is not a UUID", async () => {
      await createContextForRole("project_member")
      agentMessageId = "not-a-uuid"
      expectResponse(await subject(), 400)
    })

    it("answers 404 for an unknown project", async () => {
      await createContextForRole("project_member")
      projectId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_member")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each<ProjectRoleKey>([
      "project_owner",
      "project_admin",
      "project_member",
    ])("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 201)
    })

    it("answers 404 for a message that does not exist", async () => {
      await createContextForRole("project_member")
      agentMessageId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a message of someone else's conversation, even to a project owner", async () => {
      const { organization, project } = await createContextForRole("project_member")
      const projectOwnerAuthSubject = `oidc|${randomUUID()}`
      const { user: projectOwner } = await addUserToOrganization({
        repositories,
        organization,
        user: {
          authSubject: projectOwnerAuthSubject,
          email: mockOidcEmailForSub(projectOwnerAuthSubject),
        },
        membership: { roleKeys: ["org_member"] },
      })
      await addUserToProject({
        repositories,
        project,
        user: projectOwner,
        membership: { roleKeys: ["project_owner"] },
      })
      authSubject = projectOwnerAuthSubject

      expectResponse(await subject(), 404)
      expect(
        await repositories.agentMessageFeedbackRepository.count({ where: { agentMessageId } }),
      ).toBe(0)
    })
  })
})
