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
  createOne: async ({ type, payload, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentCsvExtractionRunsRoutes.live.createOne.response>(
      AgentCsvExtractionRunsRoutes[type].createOne.getPath(params),
      { payload } satisfies typeof AgentCsvExtractionRunsRoutes.live.createOne.request,
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  executeOne: async ({ type, recordLimit, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentCsvExtractionRunsRoutes.live.executeOne.response>(
      AgentCsvExtractionRunsRoutes[type].executeOne.getPath(params),
      {
        payload: { recordLimit },
      } satisfies typeof AgentCsvExtractionRunsRoutes.live.executeOne.request,
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  retryOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentCsvExtractionRunsRoutes.live.retryOne.response>(
      AgentCsvExtractionRunsRoutes[type].retryOne.getPath(params),
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  cancelOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentCsvExtractionRunsRoutes.live.cancelOne.response>(
      AgentCsvExtractionRunsRoutes[type].cancelOne.getPath(params),
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  getOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentCsvExtractionRunsRoutes.live.getOne.response>(
      AgentCsvExtractionRunsRoutes[type].getOne.getPath(params),
    )
    return toAgentCsvExtractionRun(response.data.data)
  },
  getAll: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentCsvExtractionRunsRoutes.live.getAll.response>(
      AgentCsvExtractionRunsRoutes[type].getAll.getPath(params),
    )
    return response.data.data.map(toAgentCsvExtractionRun)
  },
  getFileColumns: async ({ type, documentId, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AgentCsvExtractionRunsRoutes.live.getFileColumns.response
    >(AgentCsvExtractionRunsRoutes[type].getFileColumns.getPath({ ...params, documentId }))
    return response.data.data
  },
  getRecords: async ({
    type,
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

    const response = await axios.get<typeof AgentCsvExtractionRunsRoutes.live.getRecords.response>(
      AgentCsvExtractionRunsRoutes[type].getRecords.getPath({
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
  getExportTemporaryUrl: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AgentCsvExtractionRunsRoutes.live.getExportTemporaryUrl.response
    >(AgentCsvExtractionRunsRoutes[type].getExportTemporaryUrl.getPath(params))
    return response.data.data
  },
  deleteOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    await axios.delete(AgentCsvExtractionRunsRoutes[type].deleteOne.getPath(params))
  },
} satisfies IAgentCsvExtractionRunsSpi

function toAgentCsvExtractionRun(dto: AgentCsvExtractionRunDto): AgentCsvExtractionRun {
  return {
    id: dto.id,
    agentId: dto.agentId,
    agentSettingsId: dto.agentSettingsId,
    agentRevision: dto.agentRevision,
    csvDocumentId: dto.csvDocumentId,
    columnSchema: dto.columnSchema,
    type: dto.type,
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
