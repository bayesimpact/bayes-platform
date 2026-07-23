import {
  type ConversationAgentSessionDto,
  ConversationAgentSessionsRoutes,
  type ConversationSubSessionDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type {
  ConversationAgentSession,
  ConversationSubSession,
} from "../conversation-agent-sessions.models"
import type { IConversationAgentSessionsSpi } from "../conversation-agent-sessions.spi"

export default {
  getAll: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ConversationAgentSessionsRoutes.getAll.response>(
      ConversationAgentSessionsRoutes.getAll.getPath(params),
      { payload: { type } } satisfies typeof ConversationAgentSessionsRoutes.getAll.request,
    )
    return response.data.data.map(fromDto)
  },
  createOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ConversationAgentSessionsRoutes.createOne.response>(
      ConversationAgentSessionsRoutes.createOne.getPath(params),
      { payload: { type } } satisfies typeof ConversationAgentSessionsRoutes.createOne.request,
    )
    return fromDto(response.data.data)
  },
  deleteOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ConversationAgentSessionsRoutes.deleteOne.response>(
      ConversationAgentSessionsRoutes.deleteOne.getPath(params),
      { payload: { type } } satisfies typeof ConversationAgentSessionsRoutes.deleteOne.request,
    )
    return response.data.data
  },
  listSubSessions: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof ConversationAgentSessionsRoutes.listSubSessions.response
    >(ConversationAgentSessionsRoutes.listSubSessions.getPath(params), {
      payload: { type },
    } satisfies typeof ConversationAgentSessionsRoutes.listSubSessions.request)
    return response.data.data.map(fromSubSessionDto)
  },
} satisfies IConversationAgentSessionsSpi

const fromDto = (dto: ConversationAgentSessionDto): ConversationAgentSession => ({
  id: dto.id,
  agentId: dto.agentId,
  type: dto.type,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  traceUrl: dto.traceUrl,
  result: dto.result,
})

const fromSubSessionDto = (dto: ConversationSubSessionDto): ConversationSubSession => ({
  toolName: dto.toolName,
  agentId: dto.agentId,
  agentName: dto.agentName,
  outputJsonSchema: dto.outputJsonSchema,
  session: fromDto(dto.session),
})
