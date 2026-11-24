import { afterAll, beforeAll, beforeEach } from "@jest/globals"
import { getQueueToken } from "@nestjs/bullmq"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { StructuredExtractionAgentRunLlmService } from "@/domains/agents/shared/structured-extraction-agent-run-llm.service"
import { documentFactory } from "@/domains/documents/document.factory"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { LlmModule } from "@/external/llm/llm.module"
import { AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME } from "./agent-csv-extraction-run.constants"
import { agentCsvExtractionRunFactory } from "./agent-csv-extraction-run.factory"
import { AgentCsvExtractionRunCsvExportService } from "./agent-csv-extraction-run-csv-export.service"
import { AgentCsvExtractionRunProcessorService } from "./agent-csv-extraction-run-processor.service"
import { AgentCsvExtractionRunStarterService } from "./agent-csv-extraction-run-starter.service"
import { AgentCsvExtractionRunStatusNotifierService } from "./agent-csv-extraction-run-status-notifier.service"

const mockQueue = { addBulk: jest.fn() }
const mockStatusNotifier = { notifyRunStatusChanged: jest.fn() }
const mockCsvExport = { generateAndStoreDocument: jest.fn() }
const mockFileStorage = {
  save: jest.fn(),
  readFile: jest.fn(),
  getTemporaryUrl: jest.fn(),
  createReadStream: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
  buildStorageRelativePath: jest.fn(),
}

describe("AgentCsvExtractionRunStarterService", () => {
  let service: AgentCsvExtractionRunStarterService
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [LlmModule],
      providers: [
        AgentCsvExtractionRunStarterService,
        // The real processor: it owns the end of a run, which a run on no row reaches at its start.
        AgentCsvExtractionRunProcessorService,
        StructuredExtractionAgentRunLlmService,
        { provide: AgentCsvExtractionRunStatusNotifierService, useValue: mockStatusNotifier },
        { provide: AgentCsvExtractionRunCsvExportService, useValue: mockCsvExport },
        { provide: getQueueToken(AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME), useValue: mockQueue },
        { provide: FILE_STORAGE_SERVICE, useValue: mockFileStorage },
        ProjectRepository,
      ],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(AgentCsvExtractionRunStarterService)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
  })

  const seedRun = async (csvContent: string) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { name: "CSV Extractor", type: "extraction" },
        agentSettings: {
          outputJsonSchema: { type: "object", properties: { fullName: { type: "string" } } },
        },
      },
    )

    const csvDocument = documentFactory
      .transient({ organization, project })
      .build({ mimeType: "text/csv", storageRelativePath: "documents/input.csv" })
    await repositories.documentRepository.save(csvDocument)

    const run = agentCsvExtractionRunFactory
      .transient({ organization, project, agent, agentSettings, csvDocument })
      .build({ status: "pending", summary: null })
    await repositories.agentCsvExtractionRunRepository.save(run)

    mockFileStorage.readFile.mockResolvedValue(Buffer.from(csvContent, "utf-8"))

    return {
      organizationId: organization.id,
      projectId: project.id,
      run,
    }
  }

  it("startRun - should works", async () => {
    const { organizationId, projectId, run } = await seedRun("name\nJohn\nLara\n")

    await service.startRun({
      agentCsvExtractionRunId: run.id,
      organizationId,
      projectId,
      recordLimit: null,
    })

    const records = await repositories.agentCsvExtractionRunRecordRepository.find({
      where: { agentCsvExtractionRunId: run.id },
      order: { rowIndex: "ASC" },
    })
    expect(records).toHaveLength(2)
    expect(records.every((record) => record.status === "running")).toBe(true)
    expect(records.map((record) => record.inputData)).toEqual([
      { "col-name": "John" },
      { "col-name": "Lara" },
    ])

    expect(mockQueue.addBulk).toHaveBeenCalledTimes(1)
    const enqueuedJobs = mockQueue.addBulk.mock.calls[0]![0]
    expect(enqueuedJobs).toHaveLength(2)
    expect(enqueuedJobs.map((job: { opts: { jobId: string } }) => job.opts.jobId)).toEqual(
      records.map((record) => record.id),
    )

    const updatedRun = await repositories.agentCsvExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("running")
    expect(updatedRun.summary).toEqual({ total: 2, processed: 0, errors: 0, running: 2 })
  })

  it("startRun - should only process recordLimit", async () => {
    const { organizationId, projectId, run } = await seedRun("name\nJohn\nLara\nJames\n")

    await service.startRun({
      agentCsvExtractionRunId: run.id,
      organizationId,
      projectId,
      recordLimit: 1,
    })

    const records = await repositories.agentCsvExtractionRunRecordRepository.find({
      where: { agentCsvExtractionRunId: run.id },
    })
    expect(records).toHaveLength(1)
    expect(records[0]?.inputData).toEqual({ "col-name": "John" })

    const updatedRun = await repositories.agentCsvExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.summary).toEqual({ total: 1, processed: 0, errors: 0, running: 1 })
  })

  it("startRun - completes at once the run of a file with a header and no data row", async () => {
    const { organizationId, projectId, run } = await seedRun("name\n")

    await service.startRun({
      agentCsvExtractionRunId: run.id,
      organizationId,
      projectId,
      recordLimit: null,
    })

    const updatedRun = await repositories.agentCsvExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    // No record job will ever end this run: it must not stay "running".
    expect(updatedRun.status).toBe("completed")
    expect(updatedRun.summary).toEqual({ total: 0, processed: 0, errors: 0, running: 0 })
    expect(mockQueue.addBulk).not.toHaveBeenCalled()
    // Like any completed run, it gets its export and tells its status to the people who watch it.
    expect(mockCsvExport.generateAndStoreDocument).toHaveBeenCalledTimes(1)
    expect(mockStatusNotifier.notifyRunStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ agentCsvExtractionRunId: run.id, status: "completed" }),
    )
  })

  it("startRun - should throws when run not found", async () => {
    const { organizationId, projectId } = await seedRun("name\nJohn\n")

    await expect(
      service.startRun({
        agentCsvExtractionRunId: "00000000-0000-0000-0000-000000000000",
        organizationId,
        projectId,
        recordLimit: null,
      }),
    ).rejects.toThrow(/not found/)

    expect(mockQueue.addBulk).not.toHaveBeenCalled()
  })
})
