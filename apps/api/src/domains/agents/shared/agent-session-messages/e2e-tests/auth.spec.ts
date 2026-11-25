import { randomUUID } from "node:crypto"
import {
  AgentSessionMessagesRoutes,
  type BaseAgentSessionTypeDto,
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
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
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
    role: ProjectRoleKey,
    type: BaseAgentSessionTypeDto = "playground",
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
    const attachmentDocument = agentMessageAttachmentDocumentFactory
      .transient({ organization, project })
      .build()
    await repositories.agentMessageAttachmentDocumentRepository.save(attachmentDocument)
    // The session's message carries the attachment: a file is read through its conversation.
    await repositories.agentMessageRepository.update(
      { id: agentMessage.id },
      { attachmentDocumentId: attachmentDocument.id },
    )

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
      membership: { roleKeys: ["org_admin"] },
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
    describe("on the playground routes", () => {
      it("requires an authentication token", async () => {
        accessToken = null
        expectResponse(await subject("playground"), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
      })

      it("requires a valid organization ID", async () => {
        await createContextForRole("project_owner")
        organizationId = null
        expectResponse(await subject("playground"), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
      })

      it("requires a valid agent ID", async () => {
        await createContextForRole("project_owner")
        agentId = null
        expectResponse(await subject("playground"), 404)
      })

      it("requires the user to be a member of the organization", async () => {
        await createContextForRole("project_owner")
        authSubject = mockForeignAuthSubject()
        expectResponse(await subject("playground"), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
      })

      it("answers 404 for an unknown session", async () => {
        await createContextForRole("project_owner")
        agentSessionId = randomUUID()
        expectResponse(await subject("playground"), 404)
      })

      it("forbids an organization admin who holds no project role", async () => {
        const context = await createContextForRole("project_owner")
        await switchToOrganizationAdminWithoutProjectRole(context)
        expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      })
    })

    // The playground routes are open to project owners and admins only.
    it.each([
      ["project_owner"],
      ["project_admin"],
    ] as const)("allows a project %s on the playground routes", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject("playground"), successStatus)
    })

    it("forbids a plain member on the playground routes", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("answers 404 for a live session on the playground routes", async () => {
      await createContextForRole("project_owner", "live")
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

  // Evaluation serves a tester's conversation under `eval/`: its specs cover the tester's routes.
  describe("review campaign participants", () => {
    const createCampaignParticipantContext = async () => {
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
        roleKeys: ["review_campaign_tester"],
        user: {
          authSubject: participantAuthSubject,
          email: mockOidcEmailForSub(participantAuthSubject),
        },
      })
      const agentSession = conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .reviewCampaignTester()
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
    }

    it("forbids the tester on the playground routes, which check a role on the agent", async () => {
      await createCampaignParticipantContext()

      const response = await request({
        route: AgentSessionMessagesRoutes.playground.getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
        token: accessToken ?? undefined,
      })
      expectResponse(response, 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })
})
