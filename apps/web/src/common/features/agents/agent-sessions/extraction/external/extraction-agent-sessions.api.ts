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
  executeOne: async ({ documentId, type, agentSettingsRevision, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ExtractionAgentSessionsRoutes.executeOne.response>(
      ExtractionAgentSessionsRoutes.executeOne.getPath(params),
      {
        payload: { documentId, type, agentSettingsRevision },
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
  uploadDocument: async ({ file, type, ...params }) => {
    const axios = getAxiosInstance()

    const presignResponse = await axios.post<
      typeof ExtractionAgentSessionsRoutes.presignDocuments.response
    >(ExtractionAgentSessionsRoutes.presignDocuments.getPath(params), {
      payload: {
        type,
        files: [
          {
            fileName: file.name,
            mimeType: file.type as PresignFileRequestItemDto["mimeType"],
            size: file.size,
          },
        ],
      },
    } satisfies typeof ExtractionAgentSessionsRoutes.presignDocuments.request)
    const [presigned] = presignResponse.data.data
    if (!presigned) {
      throw new Error("Presign response is missing data")
    }

    await putFileToSignedUrl({ uploadUrl: presigned.uploadUrl, file })

    const confirmResponse = await axios.post<
      typeof ExtractionAgentSessionsRoutes.confirmDocuments.response
    >(ExtractionAgentSessionsRoutes.confirmDocuments.getPath(params), {
      payload: { type, documentIds: [presigned.documentId] },
    } satisfies typeof ExtractionAgentSessionsRoutes.confirmDocuments.request)
    const [document] = confirmResponse.data.data.map(fromDocumentDto)
    if (!document) {
      throw new Error("Confirm response is missing data")
    }
    return document
  },
  listMyDocuments: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ExtractionAgentSessionsRoutes.listMyDocuments.response
    >(ExtractionAgentSessionsRoutes.listMyDocuments.getPath(params), {
      payload: { type },
    } satisfies typeof ExtractionAgentSessionsRoutes.listMyDocuments.request)
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
