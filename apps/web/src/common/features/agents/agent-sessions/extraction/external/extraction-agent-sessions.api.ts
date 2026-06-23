import {
  type ExtractionAgentSessionDto,
  type ExtractionAgentSessionResultDto,
  type ExtractionAgentSessionSummaryDto,
  ExtractionAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type {
  ExtractionAgentSession,
  ExtractionAgentSessionResult,
  ExtractionAgentSessionSummary,
} from "../extraction-agent-sessions.models"
import type { IExtractionAgentSessionsSpi } from "../extraction-agent-sessions.spi"
import { streamExtractionAgentSessionStatus } from "./extraction-agent-sessions-streaming"

const api: IExtractionAgentSessionsSpi = {
  getAll: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ExtractionAgentSessionsRoutes.getAll.response>(
      ExtractionAgentSessionsRoutes.getAll.getPath(params),
      { payload: { type } } satisfies typeof ExtractionAgentSessionsRoutes.getAll.request,
    )
    return response.data.data.map(fromExtractionAgentSessionSummaryDto)
  },
  getOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ExtractionAgentSessionsRoutes.getOne.response>(
      ExtractionAgentSessionsRoutes.getOne.getPath(params),
      { payload: { type } } satisfies typeof ExtractionAgentSessionsRoutes.getOne.request,
    )
    return fromExtractionAgentSessionDto(response.data.data)
  },
  executeOne: async ({ documentId, type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ExtractionAgentSessionsRoutes.executeOne.response>(
      ExtractionAgentSessionsRoutes.executeOne.getPath(params),
      {
        payload: { documentId, type },
      } satisfies typeof ExtractionAgentSessionsRoutes.executeOne.request,
    )
    return fromExtractionAgentSessionResultDto(response.data.data)
  },
  deleteOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ExtractionAgentSessionsRoutes.deleteOne.response>(
      ExtractionAgentSessionsRoutes.deleteOne.getPath(params),
      { payload: { type } } satisfies typeof ExtractionAgentSessionsRoutes.deleteOne.request,
    )
    return response.data.data
  },
  streamSessionStatus: async (params) => {
    await streamExtractionAgentSessionStatus(params)
  },
}

export default api

function fromExtractionAgentSessionDto(dto: ExtractionAgentSessionDto): ExtractionAgentSession {
  return {
    id: dto.id,
    agentId: dto.agentId,
    documentId: dto.documentId,
    documentFileName: dto.documentFileName,
    traceUrl: dto.traceUrl,
    type: dto.type,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    result: dto.result,
    errorCode: dto.errorCode,
    errorDetails: dto.errorDetails,
  }
}

function fromExtractionAgentSessionSummaryDto(
  dto: ExtractionAgentSessionSummaryDto,
): ExtractionAgentSessionSummary {
  return {
    id: dto.id,
    agentId: dto.agentId,
    documentId: dto.documentId,
    documentFileName: dto.documentFileName,
    traceUrl: dto.traceUrl,
    type: dto.type,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

function fromExtractionAgentSessionResultDto(
  dto: ExtractionAgentSessionResultDto,
): ExtractionAgentSessionResult {
  return {
    runId: dto.runId,
  }
}
