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

const prefix =
  "organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-agent-sessions"

type Request<T = object> = RequestPayload<{ type: BaseAgentSessionTypeDto } & T>

export const ExtractionAgentSessionsRoutes = {
  executeOne: defineRoute<
    ResponseData<ExtractionAgentSessionResultDto>,
    Request<
      Pick<ExtractionAgentSessionSummaryDto, "documentId"> & { agentSettingsRevision?: number }
    >
  >({
    method: "post",
    path: `${prefix}/execute`,
  }),
  streamSessionStatus: defineRoute<ExtractionAgentSessionStatusChangedEventDto>({
    method: "get",
    path: `${prefix}/status/stream`,
  }),
  getAll: defineRoute<ResponseData<ExtractionAgentSessionSummaryDto[]>, Request>({
    method: "post",
    path: prefix,
  }),
  getOne: defineRoute<ResponseData<ExtractionAgentSessionDto>, Request>({
    method: "post",
    path: `${prefix}/:agentSessionId/getOne`,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>, Request>({
    method: "post",
    path: `/${prefix}/:agentSessionId/delete`,
  }),
  // Documents an extraction run reads are uploaded through the agent, not the project documents
  // routes: a live run is open to every project member, a playground run to admins and owners.
  presignDocuments: defineRoute<
    ResponseData<PresignFileResponseItemDto[]>,
    Request<{ files: PresignFileRequestItemDto[] }>
  >({
    method: "post",
    path: `${prefix}/documents/presign`,
  }),
  confirmDocuments: defineRoute<ResponseData<DocumentDto[]>, Request<{ documentIds: string[] }>>({
    method: "post",
    path: `${prefix}/documents/confirm`,
  }),
  listMyDocuments: defineRoute<ResponseData<DocumentDto[]>, Request>({
    method: "post",
    path: `${prefix}/documents/mine`,
  }),
}
