import {
  AGENT_SESSION_MESSAGE_ATTACHMENT_MAX_BYTES,
  AgentSessionMessagesRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { agentMessageFactory } from "../agent-messages.factory"

describe("AgentSessionMessagesRoutes.presignAttachmentDocument", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

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
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const context = await createOrganizationWithAgentSession({
      repositories,
      agentType: "conversation",
    })
    const { organization, user, project, agent, agentSession } = context

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    authSubject = user.authSubject!

    return context
  }

  type Context = Awaited<ReturnType<typeof createContext>>

  /** Puts the attachment on a new message of a conversation, as sending the turn does. */
  const sendMessageWithAttachment = async ({
    context,
    session,
    attachmentDocumentId,
  }: {
    context: Context
    session: ConversationAgentSession
    attachmentDocumentId: string
  }) => {
    const { organization, project, agentSettings } = context
    await repositories.agentMessageRepository.save(
      agentMessageFactory
        .user()
        .transient({ organization, project, session, agentSettings })
        .build({ attachmentDocumentId }),
    )
  }

  const presignAttachment = async (): Promise<string> => {
    const response = await subject({
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: 1234,
    })
    return response.body.data.attachmentDocumentId
  }

  const subject = async (
    payload: typeof AgentSessionMessagesRoutes.playground.presignAttachmentDocument.request.payload,
  ) =>
    request({
      route: AgentSessionMessagesRoutes.playground.presignAttachmentDocument,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentSessionId }),
      token: accessToken,
      request: { payload },
    })

  const getTemporaryUrlSubject = async (attachmentDocumentId: string) =>
    request({
      route: AgentSessionMessagesRoutes.playground.getAttachmentDocumentTemporaryUrl,
      pathParams: removeNullish({
        organizationId,
        projectId,
        agentId,
        agentSessionId,
        attachmentDocumentId,
      }),
      token: accessToken,
    })

  it("should create an attachment document and return a signed upload URL", async () => {
    const { organization, project } = await createContext()

    const response = await subject({
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: 1234,
    })

    expectResponse(response, 201)
    expect(response.body.data.attachmentDocumentId).toBeDefined()
    expect(response.body.data.uploadUrl).toContain("/api/local-presign-upload/")

    const attachmentDocument = await repositories.agentMessageAttachmentDocumentRepository.findOne({
      where: { id: response.body.data.attachmentDocumentId },
    })
    expect(attachmentDocument).not.toBeNull()
    expect(attachmentDocument?.organizationId).toBe(organization.id)
    expect(attachmentDocument?.projectId).toBe(project.id)
    expect(attachmentDocument?.fileName).toBe("support-notes.pdf")
    expect(attachmentDocument?.mimeType).toBe("application/pdf")
    expect(attachmentDocument?.size).toBe(1234)
    expect(attachmentDocument?.storageRelativePath).toBe(
      `${organization.id}/${project.id}/${response.body.data.attachmentDocumentId}.pdf`,
    )
  })

  it("should return a temporary URL for the attachment of a message of the conversation", async () => {
    const context = await createContext()
    const attachmentDocumentId = await presignAttachment()
    await sendMessageWithAttachment({
      context,
      session: context.agentSession,
      attachmentDocumentId,
    })

    const response = await getTemporaryUrlSubject(attachmentDocumentId)

    expectResponse(response, 201)
    expect(response.body.data.url).toContain("/documents/")
  })

  it("should answer 404 for an attachment no message of the conversation carries", async () => {
    await createContext()
    const attachmentDocumentId = await presignAttachment()

    const response = await getTemporaryUrlSubject(attachmentDocumentId)

    expectResponse(response, 404, "Attachment document not found")
  })

  it("should answer 404 for the attachment of another conversation of the project", async () => {
    const context = await createContext()
    const { organization, project, user, agent } = context
    const attachmentDocumentId = await presignAttachment()
    const otherSession = conversationAgentSessionFactory
      .transient({ organization, project, user, agent })
      .build()
    await repositories.conversationAgentSessionRepository.save(otherSession)
    await sendMessageWithAttachment({ context, session: otherSession, attachmentDocumentId })

    const response = await getTemporaryUrlSubject(attachmentDocumentId)

    expectResponse(response, 404, "Attachment document not found")
  })

  it("should reject unsupported attachment document MIME types", async () => {
    await createContext()

    const response = await subject({
      fileName: "notes.txt",
      // @ts-expect-error Testing runtime validation for an unsupported MIME type.
      mimeType: "text/plain",
      size: 1234,
    })

    expectResponse(
      response,
      422,
      "Invalid file type: text/plain. Allowed types: PDF, PNG, or JPEG.",
    )
  })

  it("should accept an attachment document of the maximum size", async () => {
    await createContext()

    const response = await subject({
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: AGENT_SESSION_MESSAGE_ATTACHMENT_MAX_BYTES,
    })

    expectResponse(response, 201)
    const attachmentDocument = await repositories.agentMessageAttachmentDocumentRepository.findOne({
      where: { id: response.body.data.attachmentDocumentId },
    })
    expect(attachmentDocument?.size).toBe(AGENT_SESSION_MESSAGE_ATTACHMENT_MAX_BYTES)
  })

  it("should reject an attachment document above the maximum size without signing a URL", async () => {
    await createContext()

    const response = await subject({
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size: AGENT_SESSION_MESSAGE_ATTACHMENT_MAX_BYTES + 1,
    })

    expectResponse(response, 400)
    expect(response.body.data).toBeUndefined()
    await expect(repositories.agentMessageAttachmentDocumentRepository.count()).resolves.toBe(0)
  })

  it.each([0, -1, 12.5])("should reject an attachment document of size %p", async (size) => {
    await createContext()

    const response = await subject({
      fileName: "support-notes.pdf",
      mimeType: "application/pdf",
      size,
    })

    expectResponse(response, 400)
    await expect(repositories.agentMessageAttachmentDocumentRepository.count()).resolves.toBe(0)
  })
})
