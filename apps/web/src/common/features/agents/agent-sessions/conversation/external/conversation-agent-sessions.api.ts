import { ConversationAgentSessionsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { IConversationAgentSessionsSpi } from "../conversation-agent-sessions.spi"
import { fromDto, fromSubSessionDto } from "./conversation-agent-sessions.mappers"

export default {
  getAll: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ConversationAgentSessionsRoutes.live.getAll.response>(
      ConversationAgentSessionsRoutes[type].getAll.getPath(params),
    )
    return response.data.data.map(fromDto)
  },
  createOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ConversationAgentSessionsRoutes.live.createOne.response
    >(ConversationAgentSessionsRoutes[type].createOne.getPath(params))
    return fromDto(response.data.data)
  },
  deleteOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ConversationAgentSessionsRoutes.live.deleteOne.response
    >(ConversationAgentSessionsRoutes[type].deleteOne.getPath(params))
    return response.data.data
  },
  listSubSessions: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ConversationAgentSessionsRoutes.live.listSubSessions.response
    >(ConversationAgentSessionsRoutes[type].listSubSessions.getPath(params))
    return response.data.data.map(fromSubSessionDto)
  },
} satisfies IConversationAgentSessionsSpi
