import { ConversationAgentSessionsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { IConversationAgentSessionsSpi } from "../conversation-agent-sessions.spi"
import { fromDto, fromSubSessionDto } from "./conversation-agent-sessions.mappers"

export default {
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ConversationAgentSessionsRoutes.playground.getAll.response
    >(ConversationAgentSessionsRoutes.playground.getAll.getPath(params))
    return response.data.data.map(fromDto)
  },
  createOne: async ({ agentSettingsRevision, variables, ...params }) => {
    const axios = getAxiosInstance()
    const payload: typeof ConversationAgentSessionsRoutes.playground.createOne.request = {
      payload: { agentSettingsRevision, variables },
    }
    const response = await axios.post<
      typeof ConversationAgentSessionsRoutes.playground.createOne.response
    >(ConversationAgentSessionsRoutes.playground.createOne.getPath(params), payload)
    return fromDto(response.data.data)
  },
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ConversationAgentSessionsRoutes.playground.deleteOne.response
    >(ConversationAgentSessionsRoutes.playground.deleteOne.getPath(params))
    return response.data.data
  },
  listSubSessions: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ConversationAgentSessionsRoutes.playground.listSubSessions.response
    >(ConversationAgentSessionsRoutes.playground.listSubSessions.getPath(params))
    return response.data.data.map(fromSubSessionDto)
  },
} satisfies IConversationAgentSessionsSpi
