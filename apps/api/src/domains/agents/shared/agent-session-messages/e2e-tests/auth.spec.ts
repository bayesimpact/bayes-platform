import { randomUUID } from "node:crypto"
import {
  AgentSessionMessagesRoutes,
  type BaseAgentSessionTypeDto,
  type ProjectMembershipRoleDto,
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
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithAgentMessage,
} from "@/domains/organizations/organization.factory"
import { addUserToReviewCampaign } from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { agentMessageAttachmentDocumentFactory } from "../agent-message-attachment-document.factory"
import { agentMessageFactory } from "../agent-messages.factory"

describe("Agent Session Messages - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let agentSessionId: string | null = randomUUID()
  let messageId: string = randomUUID()
  let attachmentDocumentId: string = randomUUID()
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
    messageId = randomUUID()
    attachmentDocumentId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  // Seeds an organization/project (membership at `role`) + conversation agent, a session of `type`
  // owned by the caller with one message, and an attachment document, so every route has a target.
  const createContextForRole = async (
    role: ProjectMembershipRoleDto,
    type: BaseAgentSessionTypeDto = "live",
  ) => {
    const { organization, project, agent, agentSession, agentMessage, user } =
      await createOrganizationWithAgentMessage({
        repositories,
        params: {
          user: { authSubject, email: mockOidcEmailForSub(authSubject) },
          projectMembership: { role },
          agentSession: { type },
        },
        agentType: "conversation",
      })
    const attachmentDocument = agentMessageAttachmentDocumentFactory
      .transient({ organization, project })
      .build()
    await repositories.agentMessageAttachmentDocumentRepository.save(attachmentDocument)

    authSubject = user.authSubject!
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    messageId = agentMessage.id
    attachmentDocumentId = attachmentDocument.id
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
      membership: { role: "admin" },
    })
    const agentSession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .build({ type })
    await repositories.conversationAgentSessionRepository.save(agentSession)
    authSubject = organizationAdminAuthSubject
    agentSessionId = agentSession.id
  }

  // Shared by the five routes: authentication, context, permissions and session type.
  const describeChecks = (
    subject: (type: BaseAgentSessionTypeDto) => ReturnType<Requester>,
    successStatus: number,
  ) => {
    describe.each([["live"], ["playground"]] as const)("on the %s routes", (type) => {
      it("requires an authentication token", async () => {
        accessToken = null
        expectResponse(await subject(type), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
      })

      it("requires a valid organization ID", async () => {
        await createContextForRole("owner", type)
        organizationId = null
        expectResponse(await subject(type), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
      })

      it("requires a valid agent ID", async () => {
        await createContextForRole("owner", type)
        agentId = null
        expectResponse(await subject(type), 404)
      })

      it("requires the user to be a member of the organization", async () => {
        await createContextForRole("owner", type)
        authSubject = mockForeignAuthSubject()
        expectResponse(await subject(type), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
      })

      it("answers 404 for an unknown session", async () => {
        await createContextForRole("owner", type)
        agentSessionId = randomUUID()
        expectResponse(await subject(type), 404)
      })

      it("forbids an organization admin who holds no project role", async () => {
        const context = await createContextForRole("owner", type)
        await switchToOrganizationAdminWithoutProjectRole(context)
        expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      })
    })

    // Live routes are open to every project role, playground routes to owners and admins only.
    it.each([
      ["owner"],
      ["admin"],
      ["member"],
    ] as const)("allows a project %s on the live routes", async (role) => {
      await createContextForRole(role, "live")
      expectResponse(await subject("live"), successStatus)
    })

    it.each([
      ["owner"],
      ["admin"],
    ] as const)("allows a project %s on the playground routes", async (role) => {
      await createContextForRole(role, "playground")
      expectResponse(await subject("playground"), successStatus)
    })

    it("forbids a plain member on the playground routes", async () => {
      await createContextForRole("member", "playground")
      expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("answers 404 for a playground session on the live routes", async () => {
      await createContextForRole("owner", "playground")
      expectResponse(await subject("live"), 404)
    })

    it("answers 404 for a live session on the playground routes", async () => {
      await createContextForRole("owner", "live")
      expectResponse(await subject("playground"), 404)
    })
  }

  describe("getAll", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: AgentSessionMessagesRoutes[type].getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
      })

    describeChecks(subject, 201)
  })

  describe("getMcpAppHtml", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: AgentSessionMessagesRoutes[type].getMcpAppHtml,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
      })

    describeChecks(subject, 201)
  })

  describe("getOne", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: AgentSessionMessagesRoutes[type].getOne,
        pathParams: removeNullish({
          organizationId,
          projectId,
          agentId,
          agentSessionId,
          messageId,
        }),
        token: accessToken ?? undefined,
      })

    describeChecks(subject, 201)
  })

  describe("presignAttachmentDocument", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: AgentSessionMessagesRoutes[type].presignAttachmentDocument,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
        request: {
          payload: { fileName: "notes.pdf", mimeType: "application/pdf", size: 1234 },
        },
      })

    describeChecks(subject, 201)
  })

  describe("getAttachmentDocumentTemporaryUrl", () => {
    const subject = async (type: BaseAgentSessionTypeDto) =>
      request({
        route: AgentSessionMessagesRoutes[type].getAttachmentDocumentTemporaryUrl,
        pathParams: removeNullish({
          organizationId,
          projectId,
          agentId,
          agentSessionId,
          attachmentDocumentId,
        }),
        token: accessToken ?? undefined,
      })

    describeChecks(subject, 201)
  })

  // A campaign role gives the live session keys on the campaign's project, without a project row.
  describe("review campaign participants", () => {
    const createCampaignParticipantContext = async (role: "tester" | "reviewer" = "tester") => {
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
        role,
        user: {
          authSubject: participantAuthSubject,
          email: mockOidcEmailForSub(participantAuthSubject),
        },
      })
      const agentSession = conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .live()
        .build({ campaignId: campaign.id })
      await repositories.conversationAgentSessionRepository.save(agentSession)
      const agentMessage = agentMessageFactory
        .transient({ organization, project, session: agentSession, agentSettings })
        .build()
      await repositories.agentMessageRepository.save(agentMessage)

      authSubject = participantAuthSubject
      organizationId = organization.id
      projectId = project.id
      agentId = agent.id
      agentSessionId = agentSession.id
      messageId = agentMessage.id
      accessToken = "token"
      return { campaign }
    }

    const closeCampaign = (campaignId: string) =>
      repositories.reviewCampaignRepository.update(
        { id: campaignId },
        { status: "closed", closedAt: new Date() },
      )

    const listMessages = () =>
      request({
        route: AgentSessionMessagesRoutes.live.getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
      })

    const getMessage = () =>
      request({
        route: AgentSessionMessagesRoutes.live.getOne,
        pathParams: removeNullish({
          organizationId,
          projectId,
          agentId,
          agentSessionId,
          messageId,
        }),
        token: accessToken ?? undefined,
      })

    const presignAttachment = () =>
      request({
        route: AgentSessionMessagesRoutes.live.presignAttachmentDocument,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
        request: {
          payload: { fileName: "notes.pdf", mimeType: "application/pdf", size: 1234 },
        },
      })

    it("lets a tester of an active campaign read and attach files in their own live session", async () => {
      await createCampaignParticipantContext()

      const messagesResponse = await listMessages()
      expectResponse(messagesResponse, 201)
      expect(messagesResponse.body.data.map((message) => message.id)).toEqual([messageId])
      const messageResponse = await getMessage()
      expectResponse(messageResponse, 201)
      expect(messageResponse.body.data.id).toBe(messageId)
      expectResponse(await presignAttachment(), 201)
    })

    it("forbids the tester to list messages or attach files once the campaign is closed", async () => {
      const { campaign } = await createCampaignParticipantContext()
      await closeCampaign(campaign.id)

      expectResponse(await listMessages(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await presignAttachment(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("forbids a reviewer-only participant", async () => {
      await createCampaignParticipantContext("reviewer")

      expectResponse(await listMessages(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await getMessage(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      expectResponse(await presignAttachment(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
