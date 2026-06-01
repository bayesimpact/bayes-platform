import {
  type AgentCsvExtractionRunDto,
  type AgentCsvExtractionRunRecordDto,
  AgentCsvExtractionRunsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type {
  AgentCsvExtractionRun,
  AgentCsvExtractionRunRecord,
} from "../agent-csv-extraction-runs.models"
import type { IAgentCsvExtractionRunsSpi } from "../agent-csv-extraction-runs.spi"
import { streamAgentCsvExtractionRunStatus } from "./agent-csv-extraction-runs-streaming"

export default {
  createOne: async ({ payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentCsvExtractionRunsRoutes.createOne.response>(
      AgentCsvExtractionRunsRoutes.createOne.getPath(params),
      { payload } satisfies typeof AgentCsvExtractionRunsRoutes.createOne.request,
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  executeOne: async ({ recordLimit, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentCsvExtractionRunsRoutes.executeOne.response>(
      AgentCsvExtractionRunsRoutes.executeOne.getPath(params),
      {
        payload: { recordLimit },
      } satisfies typeof AgentCsvExtractionRunsRoutes.executeOne.request,
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  retryOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentCsvExtractionRunsRoutes.retryOne.response>(
      AgentCsvExtractionRunsRoutes.retryOne.getPath(params),
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  cancelOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentCsvExtractionRunsRoutes.cancelOne.response>(
      AgentCsvExtractionRunsRoutes.cancelOne.getPath(params),
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  getOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentCsvExtractionRunsRoutes.getOne.response>(
      AgentCsvExtractionRunsRoutes.getOne.getPath(params),
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentCsvExtractionRunsRoutes.getAll.response>(
      AgentCsvExtractionRunsRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toAgentCsvExtractionRun)
  },
  getFileColumns: async ({ documentId, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentCsvExtractionRunsRoutes.getFileColumns.response>(
      AgentCsvExtractionRunsRoutes.getFileColumns.getPath({ ...params, documentId }),
    )
    return response.data.data
  },
  getRecords: async ({
    agentCsvExtractionRunId,
    page,
    limit,
    columnFilters,
    sortBy,
    sortOrder,
    ...params
  }) => {
    const axios = getAxiosInstance()
    const queryParams: Record<string, string> = {}
    if (page !== undefined) queryParams.page = String(page)
    if (limit !== undefined) queryParams.limit = String(limit)
    if (columnFilters && Object.keys(columnFilters).length > 0)
      queryParams.columnFilters = JSON.stringify(columnFilters)
    if (sortBy) queryParams.sortBy = sortBy
    if (sortOrder) queryParams.sortOrder = sortOrder

    const response = await axios.get<typeof AgentCsvExtractionRunsRoutes.getRecords.response>(
      AgentCsvExtractionRunsRoutes.getRecords.getPath({
        ...params,
        agentCsvExtractionRunId,
      }),
      { params: queryParams },
    )
    const data = response.data.data
    return {
      records: data.records.map(toAgentCsvExtractionRunRecord),
      total: data.total,
      page: data.page,
      limit: data.limit,
    }
  },
  streamRunStatus: async (params) => {
    await streamAgentCsvExtractionRunStatus(params)
  },
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete(AgentCsvExtractionRunsRoutes.deleteOne.getPath(params))
  },
} satisfies IAgentCsvExtractionRunsSpi

function toAgentCsvExtractionRun(dto: AgentCsvExtractionRunDto): AgentCsvExtractionRun {
  return {
    id: dto.id,
    agentId: dto.agentId,
    agentSettingsId: dto.agentSettingsId,
    csvDocumentId: dto.csvDocumentId,
    columnSchema: dto.columnSchema,
    status: dto.status,
    summary: dto.summary,
    csvExportDocumentId: dto.csvExportDocumentId,
    projectId: dto.projectId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

function toAgentCsvExtractionRunRecord(
  dto: AgentCsvExtractionRunRecordDto,
): AgentCsvExtractionRunRecord {
  return {
    id: dto.id,
    agentCsvExtractionRunId: dto.agentCsvExtractionRunId,
    rowIndex: dto.rowIndex,
    status: dto.status,
    inputData: dto.inputData,
    agentRawOutput: dto.agentRawOutput,
    errorDetails: dto.errorDetails,
    traceUrl: dto.traceUrl,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}
