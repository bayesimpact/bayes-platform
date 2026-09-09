import { AgentModel } from "@caseai-connect/api-contracts"
import type { ImagePart, TextPart } from "ai"
import { z } from "zod"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { Document } from "@/domains/documents/document.entity"
import { documentFactory } from "@/domains/documents/document.factory"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { PdfConverterClient } from "@/domains/documents/pdf-pages/pdf-converter.client"
import { PdfPageLimitExceededError } from "@/domains/documents/pdf-pages/pdf-page-limit-exceeded.error"
import { PdfPagesModule } from "@/domains/documents/pdf-pages/pdf-pages.module"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { LlmModule } from "@/external/llm/llm.module"
import { extractionAgentSessionFactory } from "./extraction-agent-session.factory"
import { ExtractionAgentSessionRunLlmService } from "./extraction-agent-session-run-llm.service"
import { ExtractionAgentSessionStatusNotifierService } from "./extraction-agent-session-status-notifier.service"

describe("ExtractionAgentSessionRunLlmService", () => {
  let service: ExtractionAgentSessionRunLlmService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let pdfConverterClient: PdfConverterClient
  let gemmaLlmProvider: LLMProvider

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [
        LlmModule,
        StorageModule,
        PdfPagesModule,
        DocumentsModule,
        ProjectsModule,
      ],
      providers: [ExtractionAgentSessionRunLlmService, ExtractionAgentSessionStatusNotifierService],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(ExtractionAgentSessionRunLlmService)
    pdfConverterClient = setup.module.get(PdfConverterClient)
    gemmaLlmProvider = setup.module.get<LLMProvider>("GemmaLLMProvider")
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  const seedPendingSessionWithDocument = async ({
    documentDesc,
    forceEmptySchema,
    model = AgentModel._Mock,
  }: {
    documentDesc: Pick<Document, "mimeType" | "sourceType" | "storageRelativePath"> &
      Partial<Pick<Document, "pdfPageCount">>
    forceEmptySchema?: true
    model?: AgentModel
  }) => {
    const schema = z.object({ content: z.string(), source: z.string() })
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: {
          type: "extraction",
        },
        agentSettings: {
          model,
          outputJsonSchema: forceEmptySchema ? undefined : schema.toJSONSchema(),
        },
      },
    )
    const document = documentFactory.transient({ organization, project }).build({ ...documentDesc })
    await repositories.documentRepository.save(document)

    const pendingSession = extractionAgentSessionFactory
      .transient({ organization, project, agent, agentSettings, user, document })
      .build({
        status: "pending",
        type: "playground",
        result: null,
        effectivePrompt: agentSettings.instructions ?? "Extract the document",
      })

    await repositories.extractionAgentSessionRepository.save(pendingSession)
    return { organization, project, schema, pendingSession, document }
  }

  it("runById - should works - pdf", async () => {
    const { organization, project, schema, pendingSession } = await seedPendingSessionWithDocument({
      documentDesc: {
        mimeType: "application/pdf",
        sourceType: "extraction",
        storageRelativePath: "test/file.pdf",
      },
    })
    await service.runById({
      extractionAgentSessionId: pendingSession.id,
      organizationId: organization.id,
      projectId: project.id,
    })

    const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({
      id: pendingSession.id,
    })
    expect(run.status).toBe("success")
    const parsed = schema.parse(run.result)
    expect(parsed.source).toBe("source-value")
    expect(parsed.content).toBe("content-value")
  })

  it("runById - should works - jpg", async () => {
    const { organization, project, schema, pendingSession } = await seedPendingSessionWithDocument({
      documentDesc: {
        mimeType: "image/jpg",
        sourceType: "extraction",
        storageRelativePath: "test/file.jpg",
      },
    })
    await service.runById({
      extractionAgentSessionId: pendingSession.id,
      organizationId: organization.id,
      projectId: project.id,
    })

    const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({
      id: pendingSession.id,
    })
    expect(run.status).toBe("success")
    const parsed = schema.parse(run.result)
    expect(parsed.source).toBe("source-value")
    expect(parsed.content).toBe("content-value")
  })
  it("runById - should throw when session not found", async () => {
    const { organization, project } = await seedPendingSessionWithDocument({
      documentDesc: {
        mimeType: "text/plain",
        sourceType: "extraction",
        storageRelativePath: "test/file.txt",
      },
    })
    await expect(
      service.runById({
        extractionAgentSessionId: "00000000-0000-0000-0000-000000000000",
        organizationId: organization.id,
        projectId: project.id,
      }),
    ).rejects.toThrow(/not found/)
  })

  it("runById - should throw EXTRACTION_PROVIDER_ERROR when empty schema", async () => {
    const { organization, project, pendingSession } = await seedPendingSessionWithDocument({
      documentDesc: {
        mimeType: "text/plain",
        sourceType: "extraction",
        storageRelativePath: "test/file.txt",
      },
      forceEmptySchema: true,
    })
    await expect(
      service.runById({
        extractionAgentSessionId: pendingSession.id,
        organizationId: organization.id,
        projectId: project.id,
      }),
    ).rejects.toThrow(/missing outputJsonSchema/)

    const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({
      id: pendingSession.id,
    })
    expect(run.status).toBe("failed")
    expect(run.result).toBeNull()
    expect(run.errorCode).toBe("EXTRACTION_PROVIDER_ERROR")
    expect(run.errorDetails?.message).toContain("missing outputJsonSchema")
  })

  it.each([
    "text/plain",
    "text/markdown",
    "text/csv",
  ])("runById - should works - %s", async (mimeType) => {
    const fileStorageService = setup.module.get<IFileStorage>(FILE_STORAGE_SERVICE)
    const readFileSpy = jest
      .spyOn(fileStorageService, "readFile")
      .mockResolvedValue(Buffer.from("# Sample document\n\nSome content."))

    const { organization, project, schema, pendingSession } = await seedPendingSessionWithDocument({
      documentDesc: {
        mimeType,
        sourceType: "extraction",
        storageRelativePath: "test/file",
      },
    })
    await service.runById({
      extractionAgentSessionId: pendingSession.id,
      organizationId: organization.id,
      projectId: project.id,
    })

    const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({
      id: pendingSession.id,
    })
    expect(run.status).toBe("success")
    expect(readFileSpy).toHaveBeenCalledWith("test/file")
    const parsed = schema.parse(run.result)
    expect(parsed.source).toBe("source-value")
    expect(parsed.content).toBe("content-value")
  })

  it("runById - should throw EXTRACTION_PROVIDER_ERROR when unsupported type", async () => {
    const { organization, project, pendingSession } = await seedPendingSessionWithDocument({
      documentDesc: {
        mimeType: "application/zip",
        sourceType: "extraction",
        storageRelativePath: "test/file.zip",
      },
    })
    await expect(
      service.runById({
        extractionAgentSessionId: pendingSession.id,
        organizationId: organization.id,
        projectId: project.id,
      }),
    ).rejects.toThrow(/Unsupported document type/)

    const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({
      id: pendingSession.id,
    })
    expect(run.status).toBe("failed")
    expect(run.result).toBeNull()
    expect(run.errorCode).toBe("EXTRACTION_PROVIDER_ERROR")
    expect(run.errorDetails?.message).toContain("Unsupported document type")
  })

  describe("runById - with a pdf document - Gemma/MedGemma image-only models", () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("sends one image part per rendered page and caches the page count on the document row", async () => {
      const { organization, project, pendingSession, document } =
        await seedPendingSessionWithDocument({
          documentDesc: {
            mimeType: "application/pdf",
            sourceType: "extraction",
            storageRelativePath: "test/file.pdf",
          },
          model: AgentModel.Gemma4_26B,
        })

      const generatePdfPageImagesSpy = jest
        .spyOn(pdfConverterClient, "generatePdfPageImages")
        .mockResolvedValue(2)
      const generateStructuredOutputSpy = jest
        .spyOn(gemmaLlmProvider, "generateStructuredOutput")
        .mockResolvedValue({ content: "content-value", source: "source-value" })

      await service.runById({
        extractionAgentSessionId: pendingSession.id,
        organizationId: organization.id,
        projectId: project.id,
      })

      expect(generatePdfPageImagesSpy).toHaveBeenCalledWith({
        sourceObject: document.storageRelativePath,
        outputPrefix: "test/derived/file/",
      })

      expect(generateStructuredOutputSpy).toHaveBeenCalledTimes(1)
      const { message } = generateStructuredOutputSpy.mock.calls[0]?.[0] ?? {}
      const content = message?.content as [TextPart, ImagePart, ImagePart]
      expect(content).toHaveLength(3)
      expect(content[0].type).toBe("text")
      expect(content[1].type).toBe("image")
      expect(String(content[1].image)).toMatch("/test/derived/file/page-1.png")
      expect(content[2].type).toBe("image")
      expect(String(content[2].image)).toMatch("/test/derived/file/page-2.png")

      const persistedDocument = await repositories.documentRepository.findOneByOrFail({
        id: document.id,
      })
      expect(persistedDocument.pdfPageCount).toBe(2)

      const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({
        id: pendingSession.id,
      })
      expect(run.status).toBe("success")
    })

    it("fails with PDF_PAGE_LIMIT_EXCEEDED when the pdf exceeds the page limit", async () => {
      const { organization, project, pendingSession } = await seedPendingSessionWithDocument({
        documentDesc: {
          mimeType: "application/pdf",
          sourceType: "extraction",
          storageRelativePath: "test/file.pdf",
        },
        model: AgentModel.Gemma4_26B,
      })

      jest
        .spyOn(pdfConverterClient, "generatePdfPageImages")
        .mockRejectedValue(new PdfPageLimitExceededError(25, 20))
      const generateStructuredOutputSpy = jest.spyOn(gemmaLlmProvider, "generateStructuredOutput")

      await expect(
        service.runById({
          extractionAgentSessionId: pendingSession.id,
          organizationId: organization.id,
          projectId: project.id,
        }),
      ).rejects.toThrow("This PDF has 25 pages; the maximum is 20 pages.")

      expect(generateStructuredOutputSpy).not.toHaveBeenCalled()
      const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({
        id: pendingSession.id,
      })
      expect(run.status).toBe("failed")
      expect(run.errorCode).toBe("PDF_PAGE_LIMIT_EXCEEDED")
      expect(run.errorDetails?.message).toBe("This PDF has 25 pages; the maximum is 20 pages.")
    })

    it("signs the cached pages without re-rendering", async () => {
      const { organization, project, pendingSession } = await seedPendingSessionWithDocument({
        documentDesc: {
          mimeType: "application/pdf",
          sourceType: "extraction",
          storageRelativePath: "test/file.pdf",
          pdfPageCount: 2,
        },
        model: AgentModel.Gemma4_26B,
      })

      const generatePdfPageImagesSpy = jest.spyOn(pdfConverterClient, "generatePdfPageImages")
      const generateStructuredOutputSpy = jest
        .spyOn(gemmaLlmProvider, "generateStructuredOutput")
        .mockResolvedValue({ content: "content-value", source: "source-value" })

      await service.runById({
        extractionAgentSessionId: pendingSession.id,
        organizationId: organization.id,
        projectId: project.id,
      })

      expect(generatePdfPageImagesSpy).not.toHaveBeenCalled()
      const { message } = generateStructuredOutputSpy.mock.calls[0]?.[0] ?? {}
      const content = message?.content as [TextPart, ImagePart, ImagePart]
      expect(content).toHaveLength(3)
      expect(String(content[1].image)).toMatch("/test/derived/file/page-1.png")
      expect(String(content[2].image)).toMatch("/test/derived/file/page-2.png")
    })
  })
})
