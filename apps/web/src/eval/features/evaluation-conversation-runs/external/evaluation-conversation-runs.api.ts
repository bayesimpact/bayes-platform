import {
  type EvaluationConversationRunDto,
  type EvaluationConversationRunRecordDto,
  EvaluationConversationRunsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunRecord,
} from "../evaluation-conversation-runs.models"
import type { IEvaluationConversationRunsSpi } from "../evaluation-conversation-runs.spi"
import { streamEvaluationConversationRunStatus } from "./evaluation-conversation-runs-streaming"

export default {
  createOne: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof EvaluationConversationRunsRoutes.createOne.response>(
      EvaluationConversationRunsRoutes.createOne.getPath(params),
      { payload } satisfies typeof EvaluationConversationRunsRoutes.createOne.request,
    )
    return toEvaluationConversationRun(response.data.data)
  },
  executeOne: async ({ recordLimit, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof EvaluationConversationRunsRoutes.executeOne.response>(
      EvaluationConversationRunsRoutes.executeOne.getPath(params),
      {
        payload: { recordLimit },
      } satisfies typeof EvaluationConversationRunsRoutes.executeOne.request,
    )
    return toEvaluationConversationRun(response.data.data)
  },
  retryOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof EvaluationConversationRunsRoutes.retryOne.response>(
      EvaluationConversationRunsRoutes.retryOne.getPath(params),
    )
    return toEvaluationConversationRun(response.data.data)
  },
  cancelOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof EvaluationConversationRunsRoutes.cancelOne.response>(
      EvaluationConversationRunsRoutes.cancelOne.getPath(params),
    )
    return toEvaluationConversationRun(response.data.data)
  },
  getOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof EvaluationConversationRunsRoutes.getOne.response>(
      EvaluationConversationRunsRoutes.getOne.getPath(params),
    )
    return toEvaluationConversationRun(response.data.data)
  },
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof EvaluationConversationRunsRoutes.getAll.response>(
      EvaluationConversationRunsRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toEvaluationConversationRun)
  },
  getRecords: async ({ evaluationConversationRunId, page, limit, ...params }) => {
    const axios = getAxiosInstance()
    const queryParams: Record<string, string> = {}
    if (page !== undefined) queryParams.page = String(page)
    if (limit !== undefined) queryParams.limit = String(limit)

    const response = await axios.get<typeof EvaluationConversationRunsRoutes.getRecords.response>(
      EvaluationConversationRunsRoutes.getRecords.getPath({
        ...params,
        evaluationConversationRunId,
      }),
      { params: queryParams },
    )
    const data = response.data.data
    return {
      records: data.records.map(toEvaluationConversationRunRecord),
      total: data.total,
      page: data.page,
      limit: data.limit,
    }
  },
  streamRunStatus: async (params) => {
    await streamEvaluationConversationRunStatus(params)
  },
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete(EvaluationConversationRunsRoutes.deleteOne.getPath(params))
  },
} satisfies IEvaluationConversationRunsSpi

function toEvaluationConversationRun(dto: EvaluationConversationRunDto): EvaluationConversationRun {
  return {
    id: dto.id,
    evaluationConversationDatasetId: dto.evaluationConversationDatasetId,
    agentId: dto.agentId,
    agentSettings: {
      documentsRagMode: dto.agentSettings.documentsRagMode,
      instructions: dto.agentSettings.instructions,
      locale: dto.agentSettings.locale,
      model: dto.agentSettings.model,
      revision: dto.agentSettings.revision,
      temperature: dto.agentSettings.temperature,
    },
    judgeModel: dto.judgeModel,
    judgeInstructions: dto.judgeInstructions,
    status: dto.status,
    summary: dto.summary,
    projectId: dto.projectId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

function toEvaluationConversationRunRecord(
  dto: EvaluationConversationRunRecordDto,
): EvaluationConversationRunRecord {
  return {
    id: dto.id,
    evaluationConversationRunId: dto.evaluationConversationRunId,
    evaluationConversationDatasetRecordId: dto.evaluationConversationDatasetRecordId,
    status: dto.status,
    input: dto.input,
    expectedOutput: dto.expectedOutput,
    output: dto.output,
    score: dto.score,
    errorDetails: dto.errorDetails,
    traceUrl: dto.traceUrl,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}
