import type { BaseAgentSessionTypeDto } from "../../agents/conversation-agent-sessions/conversation-agent-sessions.dto"
import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type { FormAgentSessionDto, FormSubSessionDto } from "./form-agent-sessions.dto"

type Request = RequestPayload<{ type: BaseAgentSessionTypeDto }>

export const FormAgentSessionsRoutes = {
  getAll: defineRoute<ResponseData<FormAgentSessionDto[]>, Request>({
    method: "post",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/form-agent-sessions",
  }),
  createOne: defineRoute<ResponseData<FormAgentSessionDto>, Request>({
    method: "post",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/form-agent-sessions/create",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>, Request>({
    method: "post",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/form-agent-sessions/:agentSessionId/delete",
  }),
  // Lists the form sub-sessions spawned by a parent agent session. `:agentId` is
  // the parent (conversation) agent and `:agentSessionId` is the parent session.
  listSubSessions: defineRoute<ResponseData<FormSubSessionDto[]>, Request>({
    method: "post",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId/form-sub-sessions",
  }),
}
