import type { ResponseData } from "../../generic"
import { defineRoute } from "../../helpers"
import type {
  AppAgentDto,
  AppConversationDto,
  AppConversationReplyDto,
} from "./apps-conversations.dto"

export const AppsAgentsRoutes = {
  getAll: defineRoute<ResponseData<AppAgentDto[]>>({
    method: "get",
    path: "apps/v1/projects/:projectId/agents",
  }),
}

export const AppsConversationsRoutes = {
  createOne: defineRoute<ResponseData<AppConversationDto>>({
    method: "post",
    path: "apps/v1/projects/:projectId/agents/:agentId/conversations",
  }),
  sendMessage: defineRoute<ResponseData<AppConversationReplyDto>>({
    method: "post",
    path: "apps/v1/projects/:projectId/agents/:agentId/conversations/:conversationId/messages",
  }),
}
