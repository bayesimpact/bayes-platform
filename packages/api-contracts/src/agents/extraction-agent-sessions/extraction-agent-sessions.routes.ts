import type { BaseAgentSessionTypeDto } from "../../agents/conversation-agent-sessions/conversation-agent-sessions.dto"
import type {
  DocumentDto,
  PresignFileRequestItemDto,
  PresignFileResponseItemDto,
} from "../../documents/documents.dto"
import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type {
  ExtractionAgentSessionDto,
  ExtractionAgentSessionResultDto,
  ExtractionAgentSessionStatusChangedEventDto,
  ExtractionAgentSessionSummaryDto,
} from "./extraction-agent-sessions.dto"

/** Live and playground runs each get their own route set, so each has its own permissions. */
function defineExtractionAgentSessionsRoutes(type: BaseAgentSessionTypeDto) {
  const prefix = `/organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions/${type}`

  return {
    executeOne: defineRoute<
      ResponseData<ExtractionAgentSessionResultDto>,
      RequestPayload<
        Pick<ExtractionAgentSessionSummaryDto, "documentId"> & { agentSettingsRevision?: number }
      >
    >({
      method: "post",
      path: `${prefix}/execute`,
    }),
    getAll: defineRoute<ResponseData<ExtractionAgentSessionSummaryDto[]>>({
      method: "post",
      path: prefix,
    }),
    getOne: defineRoute<ResponseData<ExtractionAgentSessionDto>>({
      method: "post",
      path: `${prefix}/:agentSessionId/getOne`,
    }),
    deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
      method: "post",
      path: `${prefix}/:agentSessionId/delete`,
    }),
    // The document an extraction run reads is uploaded through the agent, one at a time, not
    // through the project documents routes, which are for project owners and admins only.
    presignDocument: defineRoute<
      ResponseData<PresignFileResponseItemDto>,
      RequestPayload<{ file: PresignFileRequestItemDto }>
    >({
      method: "post",
      path: `${prefix}/documents/presign`,
    }),
    confirmDocument: defineRoute<ResponseData<DocumentDto>, RequestPayload<{ documentId: string }>>(
      {
        method: "post",
        path: `${prefix}/documents/confirm`,
      },
    ),
    listMyDocuments: defineRoute<ResponseData<DocumentDto[]>>({
      method: "post",
      path: `${prefix}/documents/mine`,
    }),
  }
}

export const ExtractionAgentSessionsRoutes = {
  live: defineExtractionAgentSessionsRoutes("live"),
  playground: defineExtractionAgentSessionsRoutes("playground"),
  // One stream for both run types: it carries status changes only, never results.
  streamSessionStatus: defineRoute<ExtractionAgentSessionStatusChangedEventDto>({
    method: "get",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions/status/stream",
  }),
}
