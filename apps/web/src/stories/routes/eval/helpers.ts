import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import type { Agent } from "@/common/features/agents/agents.models"
import type { IAgentsSpi } from "@/common/features/agents/agents.spi"
import type {
  EvaluationConversationDataset,
  PaginatedEvaluationConversationDatasetRecords,
} from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import type { IEvaluationConversationDatasetsSpi } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.spi"
import type {
  EvaluationConversationRun,
  PaginatedEvaluationConversationRunRecords,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.models"
import type { IEvaluationConversationRunsSpi } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.spi"
import type {
  EvaluationExtractionDataset,
  PaginatedEvaluationExtractionDatasetRecords,
} from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import type { IEvaluationExtractionDatasetsSpi } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.spi"
import type {
  EvaluationExtractionRun,
  PaginatedEvaluationExtractionRunRecords,
} from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.models"
import type { IEvaluationExtractionRunsSpi } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.spi"

export function buildEmptyRecordsPage<TRecord>(): {
  records: TRecord[]
  total: number
  page: number
  limit: number
} {
  return { records: [], total: 0, page: 0, limit: DEFAULT_PAGE_SIZE }
}

/**
 * Mock SPI factory (never a singleton): each story passes the same fixtures it seeds in Redux so
 * thunks dispatched by mounted components resolve to the seeded data instead of overwriting it.
 */
export function buildMockConversationDatasetsService(
  overrides: {
    datasets?: EvaluationConversationDataset[]
    records?: PaginatedEvaluationConversationDatasetRecords
  } = {},
): IEvaluationConversationDatasetsSpi {
  const datasets = overrides.datasets ?? []
  const records = overrides.records ?? buildEmptyRecordsPage()
  return {
    async getAll() {
      return datasets
    },
    async getRecords() {
      return records
    },
    async createOne() {
      return { success: true }
    },
    async renameOne() {
      return { success: true }
    },
    async deleteOne() {},
    async createRecord() {
      return { success: true }
    },
    async createRecords() {
      return { success: true }
    },
    async updateRecord() {
      return { success: true }
    },
    async deleteRecord() {},
  }
}

/** Serves the seeded agents back so the run dialog's agent picker loads inside the story. */
export function buildMockAgentsService(overrides: { agents?: Agent[] } = {}): IAgentsSpi {
  const agents = overrides.agents ?? []
  return {
    async getAll() {
      return agents
    },
    async getAllWithDrafts() {
      return agents
    },
    async createOne() {
      throw new Error("createOne is not supported in eval stories")
    },
    async updateOne() {
      return { success: true }
    },
    async deleteOne() {
      return { success: true }
    },
  }
}

export function buildMockConversationRunsService(
  overrides: {
    runs?: EvaluationConversationRun[]
    records?: PaginatedEvaluationConversationRunRecords
    // Per-run records, keyed by run id, so the compare page can show differing scores.
    recordsByRunId?: Record<string, PaginatedEvaluationConversationRunRecords>
  } = {},
): IEvaluationConversationRunsSpi {
  const runs = overrides.runs ?? []
  const records = overrides.records ?? buildEmptyRecordsPage()
  const recordsByRunId = overrides.recordsByRunId ?? {}

  const findRun = (evaluationConversationRunId: string): EvaluationConversationRun => {
    const run = runs.find((candidate) => candidate.id === evaluationConversationRunId)
    if (!run) throw new Error(`No seeded run with id ${evaluationConversationRunId}`)
    return run
  }

  return {
    async createOne() {
      const [firstRun] = runs
      if (!firstRun) throw new Error("No run seeded for createOne")
      return firstRun
    },
    async executeOne({ evaluationConversationRunId }) {
      return findRun(evaluationConversationRunId)
    },
    async retryOne({ evaluationConversationRunId }) {
      return findRun(evaluationConversationRunId)
    },
    async cancelOne({ evaluationConversationRunId }) {
      return { ...findRun(evaluationConversationRunId), status: "cancelled" }
    },
    async getOne({ evaluationConversationRunId }) {
      return findRun(evaluationConversationRunId)
    },
    async getAll() {
      return runs
    },
    async getRecords({ evaluationConversationRunId }) {
      return recordsByRunId[evaluationConversationRunId] ?? records
    },
    async streamRunStatus() {},
    async deleteOne() {},
  }
}

export function buildMockExtractionDatasetsService(
  overrides: {
    datasets?: EvaluationExtractionDataset[]
    records?: PaginatedEvaluationExtractionDatasetRecords
  } = {},
): IEvaluationExtractionDatasetsSpi {
  const datasets = overrides.datasets ?? []
  const records = overrides.records ?? buildEmptyRecordsPage()
  return {
    async getAllFiles() {
      return []
    },
    async uploadFile() {
      throw new Error("uploadFile is not seeded in stories")
    },
    async deleteFile() {},
    async getAll() {
      return datasets
    },
    async getRecords() {
      return records
    },
    async createOne() {
      return { success: true }
    },
    async renameOne() {
      return { success: true }
    },
    async updateOne() {
      return { success: true }
    },
    async getFileColumns() {
      return []
    },
    async deleteOne() {},
  }
}

export function buildMockExtractionRunsService(
  overrides: {
    runs?: EvaluationExtractionRun[]
    records?: PaginatedEvaluationExtractionRunRecords
    // Per-run records, keyed by run id, so the compare page can show differing results.
    recordsByRunId?: Record<string, PaginatedEvaluationExtractionRunRecords>
  } = {},
): IEvaluationExtractionRunsSpi {
  const runs = overrides.runs ?? []
  const records = overrides.records ?? buildEmptyRecordsPage()
  const recordsByRunId = overrides.recordsByRunId ?? {}

  const findRun = (evaluationExtractionRunId: string): EvaluationExtractionRun => {
    const run = runs.find((candidate) => candidate.id === evaluationExtractionRunId)
    if (!run) throw new Error(`No seeded run with id ${evaluationExtractionRunId}`)
    return run
  }

  return {
    async createOne() {
      const [firstRun] = runs
      if (!firstRun) throw new Error("No run seeded for createOne")
      return firstRun
    },
    async executeOne({ evaluationExtractionRunId }) {
      return findRun(evaluationExtractionRunId)
    },
    async retryOne({ evaluationExtractionRunId }) {
      return findRun(evaluationExtractionRunId)
    },
    async cancelOne({ evaluationExtractionRunId }) {
      return { ...findRun(evaluationExtractionRunId), status: "cancelled" }
    },
    async getOne({ evaluationExtractionRunId }) {
      return findRun(evaluationExtractionRunId)
    },
    async getAll() {
      return runs
    },
    async getRecords({ evaluationExtractionRunId }) {
      return recordsByRunId[evaluationExtractionRunId] ?? records
    },
    async streamRunStatus() {},
    async deleteOne() {},
  }
}
