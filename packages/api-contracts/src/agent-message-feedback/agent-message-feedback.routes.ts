import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AgentMessageFeedbackDto,
  CreateAgentMessageFeedbackDto,
} from "./agent-message-feedback.dto"

export const AgentMessageFeedbackRoutes = {
  createOne: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<CreateAgentMessageFeedbackDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agent-messages/:agentMessageId/feedbacks",
  }),
  getAll: defineRoute<ResponseData<{ feedbacks: AgentMessageFeedbackDto[] }>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/feedbacks",
  }),
}
