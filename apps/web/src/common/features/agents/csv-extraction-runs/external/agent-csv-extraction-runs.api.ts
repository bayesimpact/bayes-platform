import {
  type AgentCsvExtractionRunDto,
  type AgentCsvExtractionRunRecordDto,
  AgentCsvExtractionRunsRoutes,
} from "@bayes-platform/api-contracts"
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
    const response = await axios.post<
      typeof AgentCsvExtractionRunsRoutes.playground.createOne.response
    >(AgentCsvExtractionRunsRoutes.playground.createOne.getPath(params), {
      payload,
    } satisfies typeof AgentCsvExtractionRunsRoutes.playground.createOne.request)
    return toAgentCsvExtractionRun(response.data.data)
  },
  executeOne: async ({ recordLimit, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentCsvExtractionRunsRoutes.playground.executeOne.response
    >(AgentCsvExtractionRunsRoutes.playground.executeOne.getPath(params), {
      payload: { recordLimit },
    } satisfies typeof AgentCsvExtractionRunsRoutes.playground.executeOne.request)
    return toAgentCsvExtractionRun(response.data.data)
  },
  retryOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentCsvExtractionRunsRoutes.playground.retryOne.response
    >(AgentCsvExtractionRunsRoutes.playground.retryOne.getPath(params))
    return toAgentCsvExtractionRun(response.data.data)
  },
  cancelOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof AgentCsvExtractionRunsRoutes.playground.cancelOne.response
    >(AgentCsvExtractionRunsRoutes.playground.cancelOne.getPath(params))
    return toAgentCsvExtractionRun(response.data.data)
  },
  getOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AgentCsvExtractionRunsRoutes.playground.getOne.response
    >(AgentCsvExtractionRunsRoutes.playground.getOne.getPath(params))
    return toAgentCsvExtractionRun(response.data.data)
  },
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AgentCsvExtractionRunsRoutes.playground.getAll.response
    >(AgentCsvExtractionRunsRoutes.playground.getAll.getPath(params))
    return response.data.data.map(toAgentCsvExtractionRun)
  },
  getFileColumns: async ({ documentId, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AgentCsvExtractionRunsRoutes.playground.getFileColumns.response
    >(AgentCsvExtractionRunsRoutes.playground.getFileColumns.getPath({ ...params, documentId }))
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

    const response = await axios.get<
      typeof AgentCsvExtractionRunsRoutes.playground.getRecords.response
    >(
      AgentCsvExtractionRunsRoutes.playground.getRecords.getPath({
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
  getExportTemporaryUrl: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AgentCsvExtractionRunsRoutes.playground.getExportTemporaryUrl.response
    >(AgentCsvExtractionRunsRoutes.playground.getExportTemporaryUrl.getPath(params))
    return response.data.data
  },
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete(AgentCsvExtractionRunsRoutes.playground.deleteOne.getPath(params))
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
