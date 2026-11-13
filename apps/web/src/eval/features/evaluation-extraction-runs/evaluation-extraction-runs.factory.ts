import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { EvaluationExtractionDataset } from "../evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import type {
  EvaluationExtractionRun,
  EvaluationExtractionRunKeyMappingEntry,
  EvaluationExtractionRunRecord,
  EvaluationExtractionRunRecordFieldResult,
  EvaluationExtractionRunSummary,
} from "./evaluation-extraction-runs.models"

export const evaluationExtractionRunSummaryFactory = Factory.define<EvaluationExtractionRunSummary>(
  ({ params }) => {
    const total = params.total ?? faker.number.int({ min: 1, max: 50 })
    const errors = params.errors ?? 0
    const running = params.running ?? 0
    const mismatches = params.mismatches ?? 0
    const perfectMatches =
      params.perfectMatches ?? Math.max(total - errors - running - mismatches, 0)

    return { total, perfectMatches, mismatches, errors, running }
  },
)

export const evaluationExtractionRunRecordFieldResultFactory =
  Factory.define<EvaluationExtractionRunRecordFieldResult>(({ params }) => ({
    agentValue: params.agentValue ?? faker.lorem.word(),
    groundTruth: params.groundTruth ?? faker.lorem.word(),
    status: params.status ?? "match",
  }))

type EvaluationExtractionRunTransientParams = {
  dataset: EvaluationExtractionDataset
  agent: Agent
}

class EvaluationExtractionRunFactory extends Factory<
  EvaluationExtractionRun,
  EvaluationExtractionRunTransientParams
> {}

export const evaluationExtractionRunFactory = EvaluationExtractionRunFactory.define(
  ({ params, transientParams }) => {
    const { dataset, agent } = transientParams
    if (!dataset) {
      throw new Error(
        "Dataset must be provided in transient params to build an EvaluationExtractionRun",
      )
    }
    if (!agent) {
      throw new Error(
        "Agent must be provided in transient params to build an EvaluationExtractionRun",
      )
    }

    // Default mapping: every target column of the dataset scored against the
    // agent output key of the same name.
    const keyMapping =
      (params.keyMapping as EvaluationExtractionRunKeyMappingEntry[] | undefined) ??
      Object.values(dataset.schemaMapping)
        .filter((column) => column.role === "target")
        .map((column) => ({
          agentOutputKey: column.finalName,
          datasetColumnId: column.id,
          mode: "scored" as const,
        }))

    return {
      id: params.id ?? faker.string.uuid(),
      evaluationExtractionDatasetId: dataset.id,
      agentId: agent.id,
      agentSettingsId: params.agentSettingsId ?? faker.string.uuid(),
      agentRevision: params.agentRevision ?? faker.number.int({ min: 1, max: 20 }),
      keyMapping,
      status: params.status ?? "completed",
      summary:
        params.summary === null
          ? null
          : evaluationExtractionRunSummaryFactory.build(params.summary),
      csvExportDocumentId: params.csvExportDocumentId ?? null,
      projectId: dataset.projectId,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)

type EvaluationExtractionRunRecordTransientParams = {
  run: EvaluationExtractionRun
}

class EvaluationExtractionRunRecordFactory extends Factory<
  EvaluationExtractionRunRecord,
  EvaluationExtractionRunRecordTransientParams
> {}

export const evaluationExtractionRunRecordFactory = EvaluationExtractionRunRecordFactory.define(
  ({ params, transientParams }) => {
    const { run } = transientParams
    if (!run) {
      throw new Error(
        "Run must be provided in transient params to build an EvaluationExtractionRunRecord",
      )
    }

    const status = params.status ?? "match"

    // Default per-field comparison: one field per scored key-mapping entry,
    // all matching unless the record itself is a mismatch.
    const comparison =
      params.comparison === null
        ? null
        : ((params.comparison as
            | Record<string, EvaluationExtractionRunRecordFieldResult>
            | undefined) ??
          Object.fromEntries(
            run.keyMapping
              .filter((entry) => entry.mode === "scored")
              .map((entry, index) => [
                entry.agentOutputKey,
                evaluationExtractionRunRecordFieldResultFactory.build({
                  status: status === "mismatch" && index === 0 ? "mismatch" : "match",
                }),
              ]),
          ))

    return {
      id: params.id ?? faker.string.uuid(),
      evaluationExtractionRunId: run.id,
      evaluationExtractionDatasetRecordId:
        params.evaluationExtractionDatasetRecordId ?? faker.string.uuid(),
      status,
      comparison,
      agentRawOutput: (params.agentRawOutput as Record<string, unknown> | undefined) ?? null,
      errorDetails: params.errorDetails ?? null,
      datasetRecordData: (params.datasetRecordData as Record<string, unknown> | undefined) ?? {
        title: faker.commerce.productName(),
        summary: faker.lorem.sentence(),
      },
      traceUrl: params.traceUrl ?? null,
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)
