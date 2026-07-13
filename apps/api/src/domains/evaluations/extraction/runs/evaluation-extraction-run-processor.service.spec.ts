import { afterAll, beforeAll, beforeEach } from "@jest/globals"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { toAgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.helper"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { LlmModule } from "@/external/llm/llm.module"
import { sdk } from "@/external/llm/open-telemetry-init"
import type { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { evaluationExtractionDatasetFactory } from "../datasets/evaluation-extraction-dataset.factory"
import { evaluationExtractionRunFactory } from "./evaluation-extraction-run.factory"
import type { ProcessEvaluationExtractionRunRecordJobPayload } from "./evaluation-extraction-run.types"
import { EvaluationExtractionRunCsvExportService } from "./evaluation-extraction-run-csv-export.service"
import { EvaluationExtractionRunGraderService } from "./evaluation-extraction-run-grader.service"
import { EvaluationExtractionRunProcessorService } from "./evaluation-extraction-run-processor.service"
import { EvaluationExtractionRunStatusNotifierService } from "./evaluation-extraction-run-status-notifier.service"

const mockStatusNotifier = { notifyRunStatusChanged: jest.fn() }
const mockCsvExport = { generateAndStoreDocument: jest.fn() }

describe("EvaluationExtractionRunProcessorService", () => {
  let service: EvaluationExtractionRunProcessorService
  let mockProvider: AISDKMockProvider
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [LlmModule],
      providers: [
        EvaluationExtractionRunProcessorService,
        EvaluationExtractionRunGraderService,
        { provide: EvaluationExtractionRunStatusNotifierService, useValue: mockStatusNotifier },
        { provide: EvaluationExtractionRunCsvExportService, useValue: mockCsvExport },
      ],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(EvaluationExtractionRunProcessorService)
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

  const seedRunRecord = async (options: { recordStatus: "running" | "match" }) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { name: "Extractor", type: "extraction" },
        agentSettings: {
          instructions: "Extract the answer.",
          outputJsonSchema: { type: "object", properties: { answer: { type: "string" } } },
        },
      },
    )
    const connectScope: RequiredConnectScope = {
      organizationId: organization.id,
      projectId: project.id,
    }

    const dataset = evaluationExtractionDatasetFactory.transient({ organization, project }).build({
      name: "My Dataset",
      schemaMapping: {
        "col-question": {
          id: "col-question",
          index: 0,
          originalName: "question",
          finalName: "question",
          role: "input",
        },
        "col-answer": {
          id: "col-answer",
          index: 1,
          originalName: "answer",
          finalName: "answer",
          role: "target",
        },
      },
    })
    await repositories.evaluationExtractionDatasetRepository.save(dataset)

    const datasetRecord = repositories.evaluationExtractionDatasetRecordRepository.create({
      organizationId: organization.id,
      projectId: project.id,
      evaluationExtractionDatasetId: dataset.id,
      data: { "col-question": "1+1", "col-answer": "2" },
    })
    await repositories.evaluationExtractionDatasetRecordRepository.save(datasetRecord)

    const run = evaluationExtractionRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationExtractionDataset: dataset,
      })
      .build({
        status: "running",
        summary: { total: 1, perfectMatches: 0, mismatches: 0, errors: 0, running: 1 },
        keyMapping: [{ agentOutputKey: "answer", datasetColumnId: "col-answer", mode: "scored" }],
      })
    await repositories.evaluationExtractionRunRepository.save(run)

    const record = repositories.evaluationExtractionRunRecordRepository.create({
      organizationId: organization.id,
      projectId: project.id,
      evaluationExtractionRunId: run.id,
      evaluationExtractionDatasetRecordId: datasetRecord.id,
      status: options.recordStatus,
      comparison: null,
      agentRawOutput: null,
      errorDetails: null,
      traceId: null,
    })
    await repositories.evaluationExtractionRunRecordRepository.save(record)

    const payload: ProcessEvaluationExtractionRunRecordJobPayload = {
      connectScope,
      evaluationExtractionRun: run,
      runRecordId: record.id,
      schemaMapping: dataset.schemaMapping,
      agentWithSettings: toAgentWithSettingsRunJobPayload({ agent, agentSettings }),
    }

    return { connectScope, agent, run, record, payload }
  }

  it("processRunRecord - should works", async () => {
    const { agent, run, record, payload } = await seedRunRecord({ recordStatus: "running" })
    mockProvider.addObjectTurn(agent.id, { answer: "2" })

    await service.processRunRecord(payload)

    const updatedRecord =
      await repositories.evaluationExtractionRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("match")
    expect(updatedRecord.agentRawOutput).toEqual({ answer: "2" })
    expect(updatedRecord.comparison?.answer?.status).toBe("match")
    expect(updatedRecord.errorDetails).toBeNull()
    expect(updatedRecord.traceId).toEqual(expect.any(String))

    const updatedRun = await repositories.evaluationExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("completed")
    expect(updatedRun.summary).toEqual({
      total: 1,
      perfectMatches: 1,
      mismatches: 0,
      errors: 0,
      running: 0,
    })

    expect(mockCsvExport.generateAndStoreDocument).toHaveBeenCalledTimes(1)
    expect(mockStatusNotifier.notifyRunStatusChanged).toHaveBeenCalled()
  })

  it("processRunRecord - should works on evaluation mismatch", async () => {
    const { agent, run, record, payload } = await seedRunRecord({ recordStatus: "running" })
    mockProvider.addObjectTurn(agent.id, { answer: "999" })

    await service.processRunRecord(payload)

    const updatedRecord =
      await repositories.evaluationExtractionRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("mismatch")
    expect(updatedRecord.comparison?.answer).toEqual({
      agentValue: "999",
      groundTruth: "2",
      status: "mismatch",
    })

    const updatedRun = await repositories.evaluationExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("completed")
    expect(updatedRun.summary).toEqual({
      total: 1,
      perfectMatches: 0,
      mismatches: 1,
      errors: 0,
      running: 0,
    })
  })

  it("processRunRecord - should skips already match", async () => {
    const { record, payload } = await seedRunRecord({ recordStatus: "match" })

    await service.processRunRecord(payload)

    expect(mockProvider.getCalls()).toHaveLength(0)
    expect(mockCsvExport.generateAndStoreDocument).not.toHaveBeenCalled()
    const updatedRecord =
      await repositories.evaluationExtractionRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("match")
  })

  it("processRunRecord - should fail when no output schema", async () => {
    const { run, record, payload } = await seedRunRecord({ recordStatus: "running" })

    await service.processRunRecord({
      ...payload,
      agentWithSettings: { ...payload.agentWithSettings, outputJsonSchema: undefined },
    })

    const updatedRecord =
      await repositories.evaluationExtractionRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("error")
    expect(updatedRecord.errorDetails).toContain("outputJsonSchema")
    expect(updatedRecord.agentRawOutput).toBeNull()

    const updatedRun = await repositories.evaluationExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("failed")
    // A failed run never produces a CSV export.
    expect(mockCsvExport.generateAndStoreDocument).not.toHaveBeenCalled()
  })

  it("markRecordFailed - should works", async () => {
    const { run, record, payload } = await seedRunRecord({ recordStatus: "running" })

    await service.markRecordFailed(payload, new Error("boom"))

    const updatedRecord =
      await repositories.evaluationExtractionRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("error")
    expect(updatedRecord.errorDetails).toBe("boom")

    const updatedRun = await repositories.evaluationExtractionRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("failed")
    expect(updatedRun.summary).toEqual({
      total: 1,
      perfectMatches: 0,
      mismatches: 0,
      errors: 1,
      running: 0,
    })
  })
})
