import {
  CONVERSATION_REVIEW_UNCATEGORIZED_CATEGORY,
  ConversationReviewRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { IConversationReviewSpi } from "../conversation-review.spi"

export default {
  getOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ConversationReviewRoutes.getOne.response>(
      ConversationReviewRoutes.getOne.getPath(params),
    )
    return response.data.data
  },
  listSessionsByCategory: async ({
    organizationId,
    projectId,
    agentId,
    categoryId,
    page,
    limit,
  }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ConversationReviewRoutes.listSessions.response>(
      ConversationReviewRoutes.listSessions.getPath({ organizationId, projectId, agentId }),
      {
        params: {
          categoryId: categoryId ?? CONVERSATION_REVIEW_UNCATEGORIZED_CATEGORY,
          page,
          limit,
        },
      },
    )
    return response.data.data
  },
} satisfies IConversationReviewSpi
