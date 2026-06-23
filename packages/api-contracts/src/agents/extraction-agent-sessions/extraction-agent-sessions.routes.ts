import type { BaseAgentSessionTypeDto } from "../../agents/conversation-agent-sessions/conversation-agent-sessions.dto"
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
    Request<Pick<ExtractionAgentSessionSummaryDto, "documentId">>
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
}
