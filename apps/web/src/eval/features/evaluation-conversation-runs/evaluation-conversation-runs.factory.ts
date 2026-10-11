import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import {
  agentSettingsFactory,
  defaultAgentModels,
} from "@/common/features/agents/agent-settings/agent-settings.factory"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { Agent } from "@/common/features/agents/agents.models"
import type { EvaluationConversationDataset } from "../evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunRecord,
  EvaluationConversationRunSummary,
} from "./evaluation-conversation-runs.models"

export const evaluationConversationRunSummaryFactory =
  Factory.define<EvaluationConversationRunSummary>(({ params }) => {
    const total = params.total ?? faker.number.int({ min: 1, max: 50 })
    const errors = params.errors ?? 0
    const running = params.running ?? 0
    const graded = params.graded ?? Math.max(total - errors - running, 0)

    return {
      averageScore:
        params.averageScore !== undefined
          ? params.averageScore
          : faker.number.int({ min: 0, max: 5 }),
      errors,
      graded,
      running,
      total,
    }
  })

type EvaluationConversationRunTransientParams = {
  dataset: EvaluationConversationDataset
  agent: Agent
  agentSettings: AgentSettings
}

class EvaluationConversationRunFactory extends Factory<
  EvaluationConversationRun,
  EvaluationConversationRunTransientParams
> {}

export const evaluationConversationRunFactory = EvaluationConversationRunFactory.define(
  ({ params, transientParams }) => {
    const { dataset, agent } = transientParams
    if (!dataset) {
      throw new Error(
        "Dataset must be provided in transient params to build an EvaluationConversationRun",
      )
    }
    if (!agent) {
      throw new Error(
        "Agent must be provided in transient params to build an EvaluationConversationRun",
      )
    }

    const agentSettings =
      transientParams.agentSettings ?? agentSettingsFactory.transient({ agent }).build()

    return {
      id: params.id ?? faker.string.uuid(),
      evaluationConversationDatasetId: dataset.id,
      agentId: agent.id,
      // Snapshot of the agent settings pinned on the run, defaulted from the transient settings.
      agentSettings: {
        documentsRagMode: params.agentSettings?.documentsRagMode ?? agentSettings.documentsRagMode,
        instructions: params.agentSettings?.instructions ?? agentSettings.instructions,
        locale: params.agentSettings?.locale ?? agentSettings.locale,
        model: params.agentSettings?.model ?? agentSettings.model,
        revision: params.agentSettings?.revision ?? agentSettings.revision,
        deletedTemperature:
          params.agentSettings?.deletedTemperature ?? agentSettings.deletedTemperature,
      },
      judgeModel: params.judgeModel ?? defaultAgentModels.judge,
      judgeInstructions: params.judgeInstructions ?? null,
      status: params.status ?? "completed",
      summary:
        params.summary === null
          ? null
          : evaluationConversationRunSummaryFactory.build(params.summary),
      projectId: dataset.projectId,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)

type EvaluationConversationRunRecordTransientParams = {
  run: EvaluationConversationRun
}

class EvaluationConversationRunRecordFactory extends Factory<
  EvaluationConversationRunRecord,
  EvaluationConversationRunRecordTransientParams
> {}

export const evaluationConversationRunRecordFactory = EvaluationConversationRunRecordFactory.define(
  ({ params, transientParams }) => {
    const { run } = transientParams
    if (!run) {
      throw new Error(
        "Run must be provided in transient params to build an EvaluationConversationRunRecord",
      )
    }

    return {
      id: params.id ?? faker.string.uuid(),
      evaluationConversationRunId: run.id,
      // Nullable: the link is set to null when the source dataset record is deleted.
      evaluationConversationDatasetRecordId:
        params.evaluationConversationDatasetRecordId !== undefined
          ? params.evaluationConversationDatasetRecordId
          : faker.string.uuid(),
      status: params.status ?? "graded",
      input: params.input ?? faker.lorem.sentence(),
      expectedOutput: params.expectedOutput ?? faker.lorem.sentence(),
      output: params.output !== undefined ? params.output : faker.lorem.sentence(),
      score: params.score !== undefined ? params.score : faker.number.int({ min: 0, max: 5 }),
      errorDetails: params.errorDetails ?? null,
      traceUrl: params.traceUrl ?? null,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)
