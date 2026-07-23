import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type {
  BaseAgentSessionTypeDto,
  ConversationAgentSessionDto,
  ConversationSubSessionDto,
} from "./conversation-agent-sessions.dto"

type Request = RequestPayload<{ type: BaseAgentSessionTypeDto }>
export const ConversationAgentSessionsRoutes = {
  getAll: defineRoute<ResponseData<ConversationAgentSessionDto[]>, Request>({
    method: "post",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/conversation-agent-sessions",
  }),
  createOne: defineRoute<ResponseData<ConversationAgentSessionDto>, Request>({
    method: "post",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/conversation-agent-sessions/create",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>, Request>({
    method: "post",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/conversation-agent-sessions/:agentSessionId/delete",
  }),
  // Lists the sub-sessions spawned by a parent agent session for fillForm-enabled
  // sub-agents. `:agentId` is the parent agent and `:agentSessionId` is the parent
  // session.
  listSubSessions: defineRoute<ResponseData<ConversationSubSessionDto[]>, Request>({
    method: "post",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId/sub-sessions",
  }),
}
