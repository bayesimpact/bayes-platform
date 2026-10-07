import type { ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type {
  BaseAgentSessionTypeDto,
  ConversationAgentSessionDto,
  ConversationSubSessionDto,
} from "./conversation-agent-sessions.dto"

/** Live and playground sessions each get their own route set, so each has its own permissions. */
function defineConversationAgentSessionsRoutes(type: BaseAgentSessionTypeDto) {
  const prefix = `/organizations/:organizationId/projects/:projectId/agents/:agentId/conversation-agent-sessions/${type}`

  return {
    getAll: defineRoute<ResponseData<ConversationAgentSessionDto[]>>({
      method: "post",
      path: prefix,
    }),
    createOne: defineRoute<ResponseData<ConversationAgentSessionDto>>({
      method: "post",
      path: `${prefix}/create`,
    }),
    deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
      method: "post",
      path: `${prefix}/:agentSessionId/delete`,
    }),
    // Lists the sub-sessions spawned by a parent agent session for fillForm-enabled
    // sub-agents. `:agentId` is the parent agent and `:agentSessionId` is the parent
    // session.
    listSubSessions: defineRoute<ResponseData<ConversationSubSessionDto[]>>({
      method: "post",
      path: `${prefix}/:agentSessionId/sub-sessions`,
    }),
  }
}

export const ConversationAgentSessionsRoutes = {
  live: defineConversationAgentSessionsRoutes("live"),
  playground: defineConversationAgentSessionsRoutes("playground"),
}
