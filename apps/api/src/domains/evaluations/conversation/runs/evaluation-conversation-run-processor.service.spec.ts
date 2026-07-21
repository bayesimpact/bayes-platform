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
import { evaluationConversationDatasetFactory } from "../datasets/evaluation-conversation-dataset.factory"
import { evaluationConversationDatasetRecordFactory } from "../datasets/records/evaluation-conversation-dataset-record.factory"
import { evaluationConversationRunFactory } from "./evaluation-conversation-run.factory"
import type { ProcessEvaluationConversationRunRecordJobPayload } from "./evaluation-conversation-run.types"
import { EvaluationConversationRunGraderService } from "./evaluation-conversation-run-grader.service"
import { EvaluationConversationRunProcessorService } from "./evaluation-conversation-run-processor.service"
import { EvaluationConversationRunStatusNotifierService } from "./evaluation-conversation-run-status-notifier.service"
import { evaluationConversationRunRecordFactory } from "./records/evaluation-conversation-run-record.factory"

const RATING_AGENT_ID = "Custom-Rating-Agent"
const mockStatusNotifier = { notifyRunStatusChanged: jest.fn() }

describe("EvaluationConversationRunProcessorService", () => {
  let service: EvaluationConversationRunProcessorService
  let mockProvider: AISDKMockProvider
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [LlmModule],
      providers: [
        EvaluationConversationRunProcessorService,
        EvaluationConversationRunGraderService,
        { provide: EvaluationConversationRunStatusNotifierService, useValue: mockStatusNotifier },
      ],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(EvaluationConversationRunProcessorService)
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

  const seedRunRecord = async (options: { recordStatus: "running" | "graded" }) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { name: "Helpful Assistant", type: "conversation" },
        agentSettings: { instructions: "Answer the question." },
      },
    )
    const connectScope: RequiredConnectScope = {
      organizationId: organization.id,
      projectId: project.id,
    }

    const dataset = evaluationConversationDatasetFactory
      .transient({ organization, project })
      .build({ name: "My Dataset" })
    await repositories.evaluationConversationDatasetRepository.save(dataset)

    const datasetRecord = evaluationConversationDatasetRecordFactory
      .transient({ organization, project, evaluationConversationDataset: dataset })
      .build({ input: "What is 1+1?", expectedOutput: "2" })
    await repositories.evaluationConversationDatasetRecordRepository.save(datasetRecord)

    const run = evaluationConversationRunFactory
      .transient({
        organization,
        project,
        agent,
        agentSettings,
        evaluationConversationDataset: dataset,
      })
      .build({
        status: "running",
        summary: { total: 1, graded: 0, errors: 0, running: 1, averageScore: null },
      })
    await repositories.evaluationConversationRunRepository.save(run)

    const record = evaluationConversationRunRecordFactory
      .transient({
        organization,
        project,
        evaluationConversationRun: run,
        evaluationConversationDatasetRecord: datasetRecord,
      })
      .build({ status: options.recordStatus })
    await repositories.evaluationConversationRunRecordRepository.save(record)

    const payload: ProcessEvaluationConversationRunRecordJobPayload = {
      connectScope,
      evaluationConversationRun: run,
      runRecordId: record.id,
      agentWithSettings: toAgentWithSettingsRunJobPayload({ agent, agentSettings }),
    }

    return { connectScope, agent, run, record, payload }
  }

  it("processRunRecord - should works", async () => {
    const { agent, run, record, payload } = await seedRunRecord({ recordStatus: "running" })
    mockProvider.addTextTurn(agent.id, "The answer is 2")
    mockProvider.addTextTurn(RATING_AGENT_ID, "5")

    await service.processRunRecord(payload)

    const updatedRecord =
      await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("graded")
    expect(updatedRecord.output).toBe("The answer is 2")
    expect(updatedRecord.score).toBe(5)
    expect(updatedRecord.errorDetails).toBeNull()
    expect(updatedRecord.traceId).toEqual(expect.any(String))

    const updatedRun = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("completed")
    expect(updatedRun.summary).toEqual({
      total: 1,
      graded: 1,
      errors: 0,
      running: 0,
      averageScore: 5,
    })

    expect(mockStatusNotifier.notifyRunStatusChanged).toHaveBeenCalled()
  })

  it("processRunRecord - should fail the record when the rating is unparsable", async () => {
    const { agent, run, record, payload } = await seedRunRecord({ recordStatus: "running" })
    mockProvider.addTextTurn(agent.id, "The answer is 2")
    mockProvider.addTextTurn(RATING_AGENT_ID, "I cannot rate this")

    await service.processRunRecord(payload)

    const updatedRecord =
      await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("error")
    expect(updatedRecord.errorDetails).toContain("unparsable score")
    expect(updatedRecord.output).toBeNull()
    expect(updatedRecord.score).toBeNull()

    const updatedRun = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("failed")
    expect(updatedRun.summary).toEqual({
      total: 1,
      graded: 0,
      errors: 1,
      running: 0,
      averageScore: null,
    })
  })

  it("processRunRecord - should skips already graded", async () => {
    const { record, payload } = await seedRunRecord({ recordStatus: "graded" })

    await service.processRunRecord(payload)

    expect(mockProvider.getCalls()).toHaveLength(0)
    const updatedRecord =
      await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("graded")
  })

  it("processRunRecord - should skip when the run is cancelled", async () => {
    const { record, payload } = await seedRunRecord({ recordStatus: "running" })

    await service.processRunRecord({
      ...payload,
      evaluationConversationRun: { ...payload.evaluationConversationRun, status: "cancelled" },
    })

    expect(mockProvider.getCalls()).toHaveLength(0)
    const updatedRecord =
      await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("running")
  })

  it("markRecordFailed - should works", async () => {
    const { run, record, payload } = await seedRunRecord({ recordStatus: "running" })

    await service.markRecordFailed(payload, new Error("boom"))

    const updatedRecord =
      await repositories.evaluationConversationRunRecordRepository.findOneByOrFail({
        id: record.id,
      })
    expect(updatedRecord.status).toBe("error")
    expect(updatedRecord.errorDetails).toBe("boom")

    const updatedRun = await repositories.evaluationConversationRunRepository.findOneByOrFail({
      id: run.id,
    })
    expect(updatedRun.status).toBe("failed")
    expect(updatedRun.summary).toEqual({
      total: 1,
      graded: 0,
      errors: 1,
      running: 0,
      averageScore: null,
    })
  })
})
