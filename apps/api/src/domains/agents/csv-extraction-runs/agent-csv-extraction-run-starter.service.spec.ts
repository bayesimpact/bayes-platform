import { afterAll, beforeAll, beforeEach } from "@jest/globals"
import { getQueueToken } from "@nestjs/bullmq"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { documentFactory } from "@/domains/documents/document.factory"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME } from "./agent-csv-extraction-run.constants"
import { agentCsvExtractionRunFactory } from "./agent-csv-extraction-run.factory"
import { AgentCsvExtractionRunStarterService } from "./agent-csv-extraction-run-starter.service"

const mockQueue = { addBulk: jest.fn() }
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
      providers: [
        AgentCsvExtractionRunStarterService,
        { provide: getQueueToken(AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME), useValue: mockQueue },
        { provide: FILE_STORAGE_SERVICE, useValue: mockFileStorage },
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
