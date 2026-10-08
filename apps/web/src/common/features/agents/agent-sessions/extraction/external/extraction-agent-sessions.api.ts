import {
  type ExtractionAgentSessionDto,
  type ExtractionAgentSessionResultDto,
  type ExtractionAgentSessionSummaryDto,
  ExtractionAgentSessionsRoutes,
  type PresignFileRequestItemDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import {
  fromDocumentDto,
  putFileToSignedUrl,
} from "@/studio/features/documents/external/documents.mappers"
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
    const response = await axios.post<typeof ExtractionAgentSessionsRoutes.live.getAll.response>(
      ExtractionAgentSessionsRoutes[type].getAll.getPath(params),
    )
    return response.data.data.map(fromExtractionAgentSessionSummaryDto)
  },
  getOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ExtractionAgentSessionsRoutes.live.getOne.response>(
      ExtractionAgentSessionsRoutes[type].getOne.getPath(params),
    )
    return fromExtractionAgentSessionDto(response.data.data)
  },
  executeOne: async ({ documentId, type, agentSettingsRevision, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ExtractionAgentSessionsRoutes.live.executeOne.response
    >(ExtractionAgentSessionsRoutes[type].executeOne.getPath(params), {
      payload: { documentId, agentSettingsRevision },
    } satisfies typeof ExtractionAgentSessionsRoutes.live.executeOne.request)
    return fromExtractionAgentSessionResultDto(response.data.data)
  },
  deleteOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ExtractionAgentSessionsRoutes.live.deleteOne.response>(
      ExtractionAgentSessionsRoutes[type].deleteOne.getPath(params),
    )
    return response.data.data
  },
  streamSessionStatus: async (params) => {
    await streamExtractionAgentSessionStatus(params)
  },
  uploadDocument: async ({ file, type, ...params }) => {
    const axios = getAxiosInstance()

    const presignResponse = await axios.post<
      typeof ExtractionAgentSessionsRoutes.live.presignDocument.response
    >(ExtractionAgentSessionsRoutes[type].presignDocument.getPath(params), {
      payload: {
        file: {
          fileName: file.name,
          mimeType: file.type as PresignFileRequestItemDto["mimeType"],
          size: file.size,
        },
      },
    } satisfies typeof ExtractionAgentSessionsRoutes.live.presignDocument.request)
    const presigned = presignResponse.data.data

    await putFileToSignedUrl({ uploadUrl: presigned.uploadUrl, file })

    const confirmResponse = await axios.post<
      typeof ExtractionAgentSessionsRoutes.live.confirmDocument.response
    >(ExtractionAgentSessionsRoutes[type].confirmDocument.getPath(params), {
      payload: { documentId: presigned.documentId },
    } satisfies typeof ExtractionAgentSessionsRoutes.live.confirmDocument.request)
    return fromDocumentDto(confirmResponse.data.data)
  },
  listMyDocuments: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ExtractionAgentSessionsRoutes.live.listMyDocuments.response
    >(ExtractionAgentSessionsRoutes[type].listMyDocuments.getPath(params))
    return response.data.data.map(fromDocumentDto)
  },
}

export default api

function fromExtractionAgentSessionDto(dto: ExtractionAgentSessionDto): ExtractionAgentSession {
  return {
    id: dto.id,
    agentId: dto.agentId,
    agentRevision: dto.agentRevision,
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
    agentRevision: dto.agentRevision,
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
