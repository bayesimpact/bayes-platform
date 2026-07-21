import { AgentModel } from "@caseai-connect/api-contracts"
import { z } from "zod"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import type { Document } from "@/domains/documents/document.entity"
import { documentFactory } from "@/domains/documents/document.factory"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { LlmModule } from "@/external/llm/llm.module"
import { sdk } from "@/external/llm/open-telemetry-init"
import { extractionAgentSessionFactory } from "./extraction-agent-session.factory"
import { ExtractionAgentSessionRunnerService } from "./extraction-agent-session-runner.service"
import { ExtractionAgentSessionStatusNotifierService } from "./extraction-agent-session-status-notifier.service"

describe("ExtractionAgentSessionRunnerService", () => {
  let service: ExtractionAgentSessionRunnerService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [LlmModule, StorageModule],
      providers: [ExtractionAgentSessionRunnerService, ExtractionAgentSessionStatusNotifierService],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(ExtractionAgentSessionRunnerService)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await sdk.shutdown()
    await teardownE2eTestDatabase(setup)
  })

  const seedPendingSessionWithDocument = async ({
    documentDesc,
    forceEmptySchema,
  }: {
    documentDesc: Pick<Document, "mimeType" | "sourceType" | "storageRelativePath">
    forceEmptySchema?: true
  }) => {
    const schema = z.object({ content: z.string(), source: z.string() })
    const { organization, project, user, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: {
          type: "extraction",
        },
        agentSettings: {
          model: AgentModel._Mock,
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
    return { organization, project, schema, pendingSession }
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
})
