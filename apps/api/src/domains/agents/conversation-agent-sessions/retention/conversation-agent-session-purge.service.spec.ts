import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { agentMessageAttachmentDocumentFactory } from "@/domains/agents/shared/agent-session-messages/agent-message-attachment-document.factory"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { agentMessageFeedbackFactory } from "@/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.factory"
import { documentFactory } from "@/domains/documents/document.factory"
import { PdfConverterClient } from "@/domains/documents/pdf-pages/pdf-converter.client"
import { PdfPagesService } from "@/domains/documents/pdf-pages/pdf-pages.service"
import type { IFileStorage } from "@/domains/documents/storage/file-storage.interface"
import {
  createOrganizationWithAgentMessage,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { agentEmbedConfigFactory } from "@/domains/public-chat/agent-embed-configs/agent-embed-config.factory"
import { publicAgentSessionFactory } from "@/domains/public-chat/public-agent-sessions/public-agent-session.factory"
import { GoogleIdTokenService } from "@/external/google-iam"
import { ConversationAgentSessionPurgeService } from "./conversation-agent-session-purge.service"

describe("ConversationAgentSessionPurgeService", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let service: ConversationAgentSessionPurgeService
  let deletedStoragePaths: string[]

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({})
    repositories = setup.getAllRepositories()
    const fileStorageFake = {
      deleteFile: async (storageRelativePath: string) => {
        deletedStoragePaths.push(storageRelativePath)
      },
    } as unknown as IFileStorage
    service = new ConversationAgentSessionPurgeService(
      setup.dataSource,
      fileStorageFake,
      new PdfPagesService(new PdfConverterClient(new GoogleIdTokenService())),
    )
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    deletedStoragePaths = []
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  const createPurgeableSession = async () => {
    const context = await createOrganizationWithAgentMessage({
      repositories,
      agentType: "conversation",
    })
    const { user, organization, project, agentSession, agentSettings, agentMessage } = context

    await repositories.conversationAgentSessionRepository.update(
      { id: agentSession.id },
      { title: "Sample title", result: { field: "sample value" } },
    )
    await repositories.agentMessageRepository.update(
      { id: agentMessage.id },
      {
        role: "user",
        content: "A user question with personal data",
        toolCalls: [{ id: "tool-1", name: "lookup", arguments: { query: "sample" } }],
      },
    )
    const assistantMessage = agentMessageFactory
      .assistant()
      .transient({ organization, project, session: agentSession, agentSettings })
      .build({ content: "An assistant answer" })
    await repositories.agentMessageRepository.save(assistantMessage)

    const feedback = agentMessageFeedbackFactory
      .transient({ user, organization, project, agentMessage })
      .build({ content: "Free-text feedback" })
    await repositories.agentMessageFeedbackRepository.save(feedback)

    return { ...context, assistantMessage, feedback }
  }

  it("empties content but keeps every row and its metadata", async () => {
    const { agentSession, agentMessage, assistantMessage, feedback } =
      await createPurgeableSession()

    const { purged } = await service.purgeSessionContent(agentSession.id)
    expect(purged).toBe(true)

    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSession.id },
      order: { createdAt: "ASC" },
    })
    expect(messages.length).toBe(2)
    for (const message of messages) {
      expect(message.content).toBe("")
      expect(message.toolCalls).toBeNull()
    }
    expect(messages.map((message) => message.id).sort()).toEqual(
      [agentMessage.id, assistantMessage.id].sort(),
    )
    expect(messages.some((message) => message.role === "user")).toBe(true)

    const session = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: agentSession.id,
    })
    expect(session.title).toBeNull()
    expect(session.result).toBeNull()
    expect(session.purgedAt).not.toBeNull()

    const savedFeedback = await repositories.agentMessageFeedbackRepository.findOneByOrFail({
      id: feedback.id,
    })
    expect(savedFeedback.content).toBe("")
  })

  it("removes attachment files and their rendered pages from storage", async () => {
    const { organization, project, agentSession, agentSettings } = await createPurgeableSession()
    const attachment = agentMessageAttachmentDocumentFactory
      .transient({ organization, project })
      .build({
        storageRelativePath: `${organization.id}/${project.id}/attachment1.pdf`,
        pdfPageCount: 2,
      })
    await repositories.agentMessageAttachmentDocumentRepository.save(attachment)
    const messageWithAttachment = agentMessageFactory
      .user()
      .transient({ organization, project, session: agentSession, agentSettings })
      .build({ content: "See attached", attachmentDocumentId: attachment.id })
    await repositories.agentMessageRepository.save(messageWithAttachment)

    const { purged } = await service.purgeSessionContent(agentSession.id)
    expect(purged).toBe(true)

    expect(deletedStoragePaths.sort()).toEqual(
      [
        `${organization.id}/${project.id}/attachment1.pdf`,
        `${organization.id}/${project.id}/derived/attachment1/page-1.png`,
        `${organization.id}/${project.id}/derived/attachment1/page-2.png`,
      ].sort(),
    )
    const deletedAttachment = await repositories.agentMessageAttachmentDocumentRepository.findOne({
      where: { id: attachment.id },
    })
    expect(deletedAttachment).toBeNull()
  })

  it("removes the files of documents generated in the session from storage", async () => {
    const { organization, project, agentSession, agentSettings } = await createPurgeableSession()
    const generatedDocument = documentFactory.transient({ organization, project }).build({
      sourceType: "agentSessionMessage",
      storageRelativePath: `${organization.id}/${project.id}/generated1.pdf`,
      pdfPageCount: 1,
    })
    await repositories.documentRepository.save(generatedDocument)
    const messageWithDocument = agentMessageFactory
      .assistant()
      .transient({ organization, project, session: agentSession, agentSettings })
      .build({ content: "Here is your file", documentId: generatedDocument.id })
    await repositories.agentMessageRepository.save(messageWithDocument)

    const { purged } = await service.purgeSessionContent(agentSession.id)
    expect(purged).toBe(true)

    expect(deletedStoragePaths.sort()).toEqual(
      [
        `${organization.id}/${project.id}/generated1.pdf`,
        `${organization.id}/${project.id}/derived/generated1/page-1.png`,
      ].sort(),
    )
    const deletedDocument = await repositories.documentRepository.findOne({
      where: { id: generatedDocument.id },
    })
    expect(deletedDocument).toBeNull()
  })

  it("is idempotent: a second run does nothing", async () => {
    const { agentSession } = await createPurgeableSession()
    await service.purgeSessionContent(agentSession.id)
    const secondRun = await service.purgeSessionContent(agentSession.id)
    expect(secondRun.purged).toBe(false)
  })

  it("returns purged false for an unknown session", async () => {
    const { purged } = await service.purgeSessionContent("00000000-0000-0000-0000-000000000000")
    expect(purged).toBe(false)
  })

  const createPurgeablePublicSession = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    const agentSettings = agentSettingsFactory.transient({ organization, project, agent }).build()
    await repositories.agentSettingsRepository.save(agentSettings)
    const embedConfig = agentEmbedConfigFactory
      .transient({ organization, project, agent })
      .build({ isEnabled: true })
    await repositories.agentEmbedConfigRepository.save(embedConfig)

    const publicSession = publicAgentSessionFactory.transient({ embedConfig }).build({
      title: "Embed session title",
      result: { field: "embed value" },
      externalVisitorId: "visitor-42",
    })
    await repositories.publicAgentSessionRepository.save(publicSession)

    const publicMessage = agentMessageFactory
      .user()
      .transient({
        organization,
        project,
        session: publicSession as unknown as ConversationAgentSession,
        agentSettings,
      })
      .build({
        content: "A visitor question with personal data",
        toolCalls: [{ id: "tool-1", name: "lookup", arguments: { query: "sample" } }],
      })
    await repositories.agentMessageRepository.save(publicMessage)

    return { publicSession, publicMessage }
  }

  it("purges a public session: content and visitor id go, rows and categories stay", async () => {
    const { publicSession, publicMessage } = await createPurgeablePublicSession()

    const { purged } = await service.purgePublicSessionContent(publicSession.id)
    expect(purged).toBe(true)

    const message = await repositories.agentMessageRepository.findOneByOrFail({
      id: publicMessage.id,
    })
    expect(message.content).toBe("")
    expect(message.toolCalls).toBeNull()

    const session = await repositories.publicAgentSessionRepository.findOneByOrFail({
      id: publicSession.id,
    })
    expect(session.title).toBeNull()
    expect(session.result).toBeNull()
    expect(session.externalVisitorId).toBeNull()
    expect(session.purgedAt).not.toBeNull()
    expect(session.createdAt).toEqual(publicSession.createdAt)
  })

  it("public purge is idempotent: a second run does nothing", async () => {
    const { publicSession } = await createPurgeablePublicSession()
    await service.purgePublicSessionContent(publicSession.id)
    const secondRun = await service.purgePublicSessionContent(publicSession.id)
    expect(secondRun.purged).toBe(false)
  })
})
