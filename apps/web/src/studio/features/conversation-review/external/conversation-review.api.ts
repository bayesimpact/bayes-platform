import { ConversationReviewRoutes } from "@caseai-connect/api-contracts"
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
} satisfies IConversationReviewSpi
