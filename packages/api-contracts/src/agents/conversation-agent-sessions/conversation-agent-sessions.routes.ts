import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type {
  BaseAgentSessionTypeDto,
  ConversationAgentSessionDto,
  ConversationReviewDto,
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
    createOne: defineRoute<
      ResponseData<ConversationAgentSessionDto>,
      RequestPayload<{
        /**
         * Settings revision the session greets with. Playground sessions only, like the
         * revision of the stream: a live session that sends one is rejected. Omitted, a
         * playground session greets with the latest revision including the draft and a live
         * session with the latest published one.
         */
        agentSettingsRevision?: number
      }>
    >({
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

/**
 * Safety review: any conversation of the agent, live or playground and whoever had it, read from
 * its session id. Needs the global `agent.conversation.review` permission.
 */
export const ConversationReviewRoutes = {
  getOne: defineRoute<ResponseData<ConversationReviewDto>>({
    method: "get",
    path: "/organizations/:organizationId/projects/:projectId/agents/:agentId/conversation-review/:agentSessionId",
  }),
}
