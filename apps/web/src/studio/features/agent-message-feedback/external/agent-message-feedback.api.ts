import {
  type AgentMessageFeedbackDto,
  AgentMessageFeedbackRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AgentMessageFeedback } from "../agent-message-feedback.models"
import type { IAgentMessageFeedbackSpi } from "../agent-message-feedback.spi"

export default {
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentMessageFeedbackRoutes.getAll.response>(
      AgentMessageFeedbackRoutes.getAll.getPath(params),
    )
    return response.data.data.feedbacks.map(toFeedback)
  },
  createOne: async ({ organizationId, projectId, agentMessageId, rating, content }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentMessageFeedbackRoutes.createOne.response>(
      AgentMessageFeedbackRoutes.createOne.getPath({
        organizationId,
        projectId,
        agentMessageId,
      }),
      {
        payload: { rating, content },
      } satisfies typeof AgentMessageFeedbackRoutes.createOne.request,
    )
    return response.data.data
  },
} satisfies IAgentMessageFeedbackSpi

function toFeedback(dto: AgentMessageFeedbackDto): AgentMessageFeedback {
  return {
    id: dto.id,
    organizationId: dto.organizationId,
    projectId: dto.projectId,
    agentId: dto.agentId,
    agentSessionId: dto.agentSessionId,
    agentMessageId: dto.agentMessageId,
    agentMessageContent: dto.agentMessageContent,
    traceUrl: dto.traceUrl,
    userId: dto.userId,
    rating: dto.rating,
    content: dto.content,
    createdAt: dto.createdAt,
  }
}
