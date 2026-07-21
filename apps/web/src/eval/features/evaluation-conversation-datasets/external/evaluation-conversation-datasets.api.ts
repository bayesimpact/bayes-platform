import {
  type EvaluationConversationDatasetDto,
  type EvaluationConversationDatasetRecordDto,
  EvaluationConversationDatasetsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type {
  EvaluationConversationDataset,
  EvaluationConversationDatasetRecord,
} from "../evaluation-conversation-datasets.models"
import type { IEvaluationConversationDatasetsSpi } from "../evaluation-conversation-datasets.spi"

export default {
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof EvaluationConversationDatasetsRoutes.getAll.response>(
      EvaluationConversationDatasetsRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toDataset)
  },
  getRecords: async ({ datasetId, page, limit, ...params }) => {
    const axios = getAxiosInstance()
    const queryParams: Record<string, string> = {}
    if (page !== undefined) queryParams.page = String(page)
    if (limit !== undefined) queryParams.limit = String(limit)

    const response = await axios.get<
      typeof EvaluationConversationDatasetsRoutes.getRecords.response
    >(
      EvaluationConversationDatasetsRoutes.getRecords.getPath({
        ...params,
        datasetId,
      }),
      {
        params: queryParams,
      },
    )
    const paginatedRecords = response.data.data
    return {
      records: paginatedRecords.records.map(toRecord),
      total: paginatedRecords.total,
      page: paginatedRecords.page,
      limit: paginatedRecords.limit,
    }
  },
  createOne: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof EvaluationConversationDatasetsRoutes.createOne.response
    >(EvaluationConversationDatasetsRoutes.createOne.getPath(params), {
      payload,
    } satisfies typeof EvaluationConversationDatasetsRoutes.createOne.request)
    return response.data.data
  },
  renameOne: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.patch<
      typeof EvaluationConversationDatasetsRoutes.renameOne.response
    >(EvaluationConversationDatasetsRoutes.renameOne.getPath(params), {
      payload,
    } satisfies typeof EvaluationConversationDatasetsRoutes.renameOne.request)
    return response.data.data
  },
  deleteOne: async ({ datasetId, ...params }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      EvaluationConversationDatasetsRoutes.deleteOne.getPath({ ...params, datasetId }),
    )
  },
  createRecord: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof EvaluationConversationDatasetsRoutes.createRecord.response
    >(EvaluationConversationDatasetsRoutes.createRecord.getPath(params), {
      payload,
    } satisfies typeof EvaluationConversationDatasetsRoutes.createRecord.request)
    return response.data.data
  },
  createRecords: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof EvaluationConversationDatasetsRoutes.createRecords.response
    >(EvaluationConversationDatasetsRoutes.createRecords.getPath(params), {
      payload,
    } satisfies typeof EvaluationConversationDatasetsRoutes.createRecords.request)
    return response.data.data
  },
  updateRecord: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.patch<
      typeof EvaluationConversationDatasetsRoutes.updateRecord.response
    >(EvaluationConversationDatasetsRoutes.updateRecord.getPath(params), {
      payload,
    } satisfies typeof EvaluationConversationDatasetsRoutes.updateRecord.request)
    return response.data.data
  },
  deleteRecord: async ({ datasetId, recordId, ...params }) => {
    const axios = getAxiosInstance()
    await axios.delete(
      EvaluationConversationDatasetsRoutes.deleteRecord.getPath({ ...params, datasetId, recordId }),
    )
  },
} satisfies IEvaluationConversationDatasetsSpi

function toDataset(dto: EvaluationConversationDatasetDto): EvaluationConversationDataset {
  return {
    createdAt: dto.createdAt,
    id: dto.id,
    name: dto.name,
    projectId: dto.projectId,
    recordCount: dto.recordCount,
    updatedAt: dto.updatedAt,
  }
}

function toRecord(
  dto: EvaluationConversationDatasetRecordDto,
): EvaluationConversationDatasetRecord {
  return {
    createdAt: dto.createdAt,
    expectedOutput: dto.expectedOutput,
    id: dto.id,
    input: dto.input,
    updatedAt: dto.updatedAt,
  }
}
