import { randomUUID } from "node:crypto"
import { LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE } from "@caseai-connect/api-contracts"
import { IsNull, Not } from "typeorm"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { AgentMessageToolCall } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import type { Document } from "@/domains/documents/document.entity"
import { documentFactory } from "@/domains/documents/document.factory"
import { DocumentSourcesService } from "@/domains/documents/sources/document-sources.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { withDocumentEmbeddingsBatchServiceMock } from "@/domains/documents/test-overrides"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import type { MaintenanceJobProgress } from "../maintenance-job.interface"
import { LegacyWebCrawlMigrationJob } from "./legacy-web-crawl-migration.job"
import { LegacyWebCrawlMigrationModule } from "./legacy-web-crawl-migration.module"

describe("LegacyWebCrawlMigrationJob", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let job: LegacyWebCrawlMigrationJob
  let documentSourcesService: DocumentSourcesService
  let fileStorageService: IFileStorage

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [LegacyWebCrawlMigrationModule],
      applyOverrides: withDocumentEmbeddingsBatchServiceMock,
    })
    repositories = setup.getAllRepositories()
    job = setup.module.get(LegacyWebCrawlMigrationJob)
    documentSourcesService = setup.module.get(DocumentSourcesService)
    fileStorageService = setup.module.get<IFileStorage>(FILE_STORAGE_SERVICE)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  const pages = [
    { url: "https://docs.example.com/", markdown: "# Welcome\n\nThe home page." },
    { url: "https://docs.example.com/pricing", markdown: "Plans and prices." },
    { url: "https://docs.example.com/empty", markdown: "   " },
  ]

  const createContext = async ({
    content = JSON.stringify(pages),
  }: {
    content?: string | null
  } = {}) => {
    const data = await createOrganizationWithAgentSession({
      repositories,
      agentType: "conversation",
    })
    const { organization, project, user } = data
    const legacyDocument = documentFactory.transient({ organization, project }).build({
      title: "Product documentation",
      sourceType: "webCrawl",
      sourceUrl: "https://docs.example.com/",
      mimeType: "text/html",
      content: content as string,
      fileName: null as unknown as string,
      storageRelativePath: null as unknown as string,
      embeddingStatus: "completed",
    })
    const otherDocument = documentFactory.transient({ organization, project }).build()
    await repositories.documentRepository.save([legacyDocument, otherDocument])
    return {
      ...data,
      connectScope: { organizationId: organization.id, projectId: project.id },
      legacyDocument,
      otherDocument,
      userId: user.id,
    }
  }

  const sourcesCall = (documents: Document[]): AgentMessageToolCall => ({
    id: randomUUID(),
    name: "sources",
    arguments: {
      sources: documents.map((document) => ({
        documentId: document.id,
        documentTitle: document.title,
        documentSourceType: document.sourceType,
        chunks: [{ chunkId: randomUUID(), partialContent: "Some text" }],
      })),
    },
  })

  const run = (userId: string) => {
    const progress: MaintenanceJobProgress[] = []
    return job
      .run({
        requestedByUserId: userId,
        reportProgress: async (current) => {
          progress.push(current)
        },
      })
      .then((result) => ({ result, progress }))
  }

  it("turns a legacy web crawl into a source with one document per page", async () => {
    const { connectScope, legacyDocument, userId } = await createContext()

    await expect(job.preview()).resolves.toEqual({
      remainingCount: 1,
      remainingSummary: "1 web crawl(s) in 1 project(s)",
    })

    const { result, progress } = await run(userId)

    expect(result.summary).toBe("1 web crawl(s) migrated into 2 page document(s).")
    expect(progress).toEqual([
      { done: 0, total: 1 },
      { done: 1, total: 1 },
    ])

    const [source] = await documentSourcesService.getAll(connectScope)
    expect(source).toMatchObject({
      name: "Product documentation",
      type: LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE,
      externalId: `${LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE}:${legacyDocument.id}`,
      baseUrl: "https://docs.example.com/",
      appInstallationId: null,
    })

    const pageDocuments = await repositories.documentRepository.find({
      where: { documentSourceId: source?.id },
      order: { sourceUrl: "ASC" },
    })
    expect(
      pageDocuments.map((document) => ({
        title: document.title,
        sourceUrl: document.sourceUrl,
        sourceType: document.sourceType,
        content: document.content,
        userId: document.userId,
      })),
    ).toEqual([
      {
        title: "Welcome",
        sourceUrl: "https://docs.example.com/",
        sourceType: "app",
        content: "# Welcome\n\nThe home page.",
        userId,
      },
      {
        title: "https://docs.example.com/pricing",
        sourceUrl: "https://docs.example.com/pricing",
        sourceType: "app",
        content: "Plans and prices.",
        userId,
      },
    ])
    await expect(
      fileStorageService.readFile(pageDocuments[1]?.storageRelativePath ?? ""),
    ).resolves.toEqual(Buffer.from("Plans and prices.", "utf8"))

    await expect(
      repositories.documentRepository.findOne({ where: { id: legacyDocument.id } }),
    ).resolves.toBeNull()
    await expect(job.preview()).resolves.toEqual({
      remainingCount: 0,
      remainingSummary: "0 web crawl(s) in 0 project(s)",
    })
  })

  it("removes the legacy document from the citations and deletes its chunks", async () => {
    const {
      organization,
      project,
      agentSession,
      agentSettings,
      legacyDocument,
      otherDocument,
      userId,
    } = await createContext()
    const messageFactory = agentMessageFactory.transient({
      organization,
      project,
      session: agentSession as ConversationAgentSession,
      agentSettings,
    })
    const lookupCall: AgentMessageToolCall = {
      id: randomUUID(),
      name: "lookup_knowledge_base",
      arguments: { query: "prices", documentIds: [legacyDocument.id] },
    }
    const assistantMessage = messageFactory.assistant().build({
      toolCalls: [lookupCall, sourcesCall([legacyDocument, otherDocument])],
    })
    const toolMessage = messageFactory.build({
      role: "tool",
      toolCalls: [sourcesCall([legacyDocument])],
    })
    await repositories.agentMessageRepository.save([assistantMessage, toolMessage])
    await setup.dataSource.query(
      `INSERT INTO document_chunk (id, organization_id, project_id, document_id, content, embed_text, chunk_index)
       VALUES ($1, $2, $3, $4, 'Plans and prices.', 'Plans and prices.', 0)`,
      [randomUUID(), organization.id, project.id, legacyDocument.id],
    )

    await run(userId)

    const savedAssistantMessage = await repositories.agentMessageRepository.findOneOrFail({
      where: { id: assistantMessage.id },
    })
    expect(savedAssistantMessage.toolCalls?.map((toolCall) => toolCall.name)).toEqual([
      "lookup_knowledge_base",
      "sources",
    ])
    const remainingSources = savedAssistantMessage.toolCalls?.[1]?.arguments.sources as {
      documentId: string
    }[]
    expect(remainingSources.map((source) => source.documentId)).toEqual([otherDocument.id])

    const savedToolMessage = await repositories.agentMessageRepository.findOneOrFail({
      where: { id: toolMessage.id },
    })
    expect(savedToolMessage.toolCalls).toEqual([])

    const chunks: unknown[] = await setup.dataSource.query(
      `SELECT id FROM document_chunk WHERE document_id = $1`,
      [legacyDocument.id],
    )
    expect(chunks).toHaveLength(0)
  })

  it("does nothing more when it runs again", async () => {
    const { connectScope, userId } = await createContext()

    await run(userId)
    const { result } = await run(userId)

    expect(result.summary).toBe("0 web crawl(s) migrated into 0 page document(s).")
    const sources = await documentSourcesService.getAll(connectScope)
    expect(sources).toHaveLength(1)
    await expect(
      repositories.documentRepository.count({ where: { documentSourceId: sources[0]?.id } }),
    ).resolves.toBe(2)
  })

  it("starts the pages over when a previous run stopped halfway", async () => {
    const { organization, project, connectScope, legacyDocument, userId } = await createContext()
    const source = await documentSourcesService.createOne(connectScope, {
      name: "Product documentation",
      type: LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE,
      externalId: `${LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE}:${legacyDocument.id}`,
      baseUrl: "https://docs.example.com/",
      config: null,
    })
    const halfDone = documentFactory
      .transient({ organization, project })
      .build({ sourceType: "app", documentSourceId: source.id })
    await repositories.documentRepository.save(halfDone)

    await run(userId)

    await expect(documentSourcesService.getAll(connectScope)).resolves.toHaveLength(1)
    const activeDocuments = await repositories.documentRepository.find({
      where: { documentSourceId: source.id, deletedAt: IsNull() },
    })
    expect(activeDocuments.map((document) => document.sourceUrl).sort()).toEqual([
      "https://docs.example.com/",
      "https://docs.example.com/pricing",
    ])
    await expect(
      repositories.documentRepository.count({
        where: { id: halfDone.id, deletedAt: Not(IsNull()) },
        withDeleted: true,
      }),
    ).resolves.toBe(1)
  })

  it("only removes a crawl that never ended", async () => {
    const { connectScope, legacyDocument, userId } = await createContext({ content: null })

    const { result } = await run(userId)

    expect(result.summary).toBe("1 web crawl(s) migrated into 0 page document(s).")
    await expect(documentSourcesService.getAll(connectScope)).resolves.toHaveLength(0)
    await expect(
      repositories.documentRepository.findOne({ where: { id: legacyDocument.id } }),
    ).resolves.toBeNull()
  })
})
