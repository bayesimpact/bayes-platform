import { afterAll, beforeAll, beforeEach } from "@jest/globals"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { toAgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.helper"
import { documentFactory } from "@/domains/documents/document.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { LlmModule } from "@/external/llm/llm.module"
import { sdk } from "@/external/llm/open-telemetry-init"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { agentCsvExtractionRunFactory } from "./agent-csv-extraction-run.factory"
import type { ProcessAgentCsvExtractionRunRecordJobPayload } from "./agent-csv-extraction-run.types"
import { AgentCsvExtractionRunCsvExportService } from "./agent-csv-extraction-run-csv-export.service"
import { AgentCsvExtractionRunProcessorService } from "./agent-csv-extraction-run-processor.service"
import { agentCsvExtractionRunRecordFactory } from "./agent-csv-extraction-run-record.factory"
import { AgentCsvExtractionRunStatusNotifierService } from "./agent-csv-extraction-run-status-notifier.service"

const mockStatusNotifier = { notifyRunStatusChanged: jest.fn() }
const mockCsvExport = { generateAndStoreDocument: jest.fn() }

describe("AgentCsvExtractionRunProcessorService", () => {
  let service: AgentCsvExtractionRunProcessorService
  let mockProvider: AISDKMockProvider
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [LlmModule],
      providers: [
        AgentCsvExtractionRunProcessorService,
        { provide: AgentCsvExtractionRunStatusNotifierService, useValue: mockStatusNotifier },
        { provide: AgentCsvExtractionRunCsvExportService, useValue: mockCsvExport },
      ],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(AgentCsvExtractionRunProcessorService)
    mockProvider = setup.module.get<AISDKMockProvider>("_MockLLMProvider")
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    mockProvider.resetMock()
    jest.clearAllMocks()
  })

  const seedExtractionRunRecord = async (options?: { recordStatus: "running" | "success" }) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { name: "CSV Extractor", type: "extraction" },
        agentSettings: {
          instructions: "Extract the full name.",
          outputJsonSchema: { type: "object", properties: { fullName: { type: "string" } } },
        },
      },
    )
    const connectScope: RequiredConnectScope = {
      organizationId: organization.id,
      projectId: project.id,
    }

    const csvDocument = documentFactory.transient({ organization, project }).build()
    await repositories.documentRepository.save(csvDocument)

    const run = agentCsvExtractionRunFactory
      .transient({ organization, project, agent, agentSettings, csvDocument })
      .build({
        status: "running",
        summary: { total: 1, processed: 0, errors: 0, running: 1 },
      })
    await repositories.agentCsvExtractionRunRepository.save(run)

    const record = agentCsvExtractionRunRecordFactory
      .transient({ organization, project, agentCsvExtractionRun: run })
      .build({
        rowIndex: 0,
        status: options?.recordStatus,
        inputData: { "col-name": "Doe", "col-forName": "John" },
        agentRawOutput: null,
      })
    await repositories.agentCsvExtractionRunRecordRepository.save(record)

    const payload: ProcessAgentCsvExtractionRunRecordJobPayload = {
      connectScope,
      agentCsvExtractionRun: run,
      runRecordId: record.id,
      columnSchema: run.columnSchema,
      agentWithSettings: toAgentWithSettingsRunJobPayload({ agent, agentSettings }),
    }

    return { connectScope, agent, run, record, payload }
  }

  it("processRunRecord - should works", async () => {
    const { agent, run, record, payload } = await seedExtractionRunRecord()
    mockProvider.addObjectTurn(agent.id, { fullName: "John Doe" })

    await service.processRunRecord(payload)

    const updatedRecord = await repositories.agentCsvExtractionRunRecordRepository.findOneByOrFail({
      id: record.id,
    })
    expect(updatedRecord.status).toBe("success")
    expect(updatedRecord.agentRawOutput).toEqual({ fullName: "John Doe" })
    expect(updatedRecord.errorDetails).toBeNull()
    expect(updatedRecord.traceId).toEqual(expect.any(String))

    const updatedRun = await repositories.agentCsvExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("completed")
    expect(updatedRun.summary).toEqual({ total: 1, processed: 1, errors: 0, running: 0 })

    // The last worker to finish the run owns the one-off export + notification.
    expect(mockCsvExport.generateAndStoreDocument).toHaveBeenCalledTimes(1)
    expect(mockStatusNotifier.notifyRunStatusChanged).toHaveBeenCalled()
  })

  it("processRunRecord - should skips already success", async () => {
    const { record, payload } = await seedExtractionRunRecord({ recordStatus: "success" })

    await service.processRunRecord(payload)

    expect(mockProvider.getCalls()).toHaveLength(0)
    expect(mockCsvExport.generateAndStoreDocument).not.toHaveBeenCalled()
    const updatedRecord = await repositories.agentCsvExtractionRunRecordRepository.findOneByOrFail({
      id: record.id,
    })
    expect(updatedRecord.status).toBe("success")
  })

  it("processRunRecord - should fail when no output schema", async () => {
    const { run, record, payload } = await seedExtractionRunRecord()

    await service.processRunRecord({
      ...payload,
      agentWithSettings: { ...payload.agentWithSettings, outputJsonSchema: undefined },
    })

    const updatedRecord = await repositories.agentCsvExtractionRunRecordRepository.findOneByOrFail({
      id: record.id,
    })
    expect(updatedRecord.status).toBe("error")
    expect(updatedRecord.errorDetails).toContain("outputJsonSchema")
    expect(updatedRecord.agentRawOutput).toBeNull()

    const updatedRun = await repositories.agentCsvExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("failed")
    expect(updatedRun.summary).toEqual({ total: 1, processed: 0, errors: 1, running: 0 })
  })

  it("markRecordFailed - should works", async () => {
    const { run, record, payload } = await seedExtractionRunRecord()

    await service.markRecordFailed(payload, new Error("expected error"))

    const updatedRecord = await repositories.agentCsvExtractionRunRecordRepository.findOneByOrFail({
      id: record.id,
    })
    expect(updatedRecord.status).toBe("error")
    expect(updatedRecord.errorDetails).toBe("expected error")

    const updatedRun = await repositories.agentCsvExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("failed")
    expect(updatedRun.summary).toEqual({ total: 1, processed: 0, errors: 1, running: 0 })
  })
})
