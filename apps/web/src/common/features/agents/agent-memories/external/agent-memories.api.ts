import { AgentMemoriesRoutes, type AgentMemoryDto } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AgentMemory } from "../agent-memories.models"
import type { IAgentMemoriesSpi } from "../agent-memories.spi"

export default {
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentMemoriesRoutes.getAll.response>(
      AgentMemoriesRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toAgentMemory)
  },
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.delete<typeof AgentMemoriesRoutes.deleteOne.response>(
      AgentMemoriesRoutes.deleteOne.getPath(params),
    )
    return response.data.data
  },
  deleteAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.delete<typeof AgentMemoriesRoutes.deleteAll.response>(
      AgentMemoriesRoutes.deleteAll.getPath(params),
    )
    return response.data.data
  },
  resolveProposals: async (params, decisions) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentMemoriesRoutes.resolveProposals.response>(
      AgentMemoriesRoutes.resolveProposals.getPath(params),
      { payload: { decisions } } satisfies typeof AgentMemoriesRoutes.resolveProposals.request,
    )
    return response.data.data.map(toAgentMemory)
  },
} satisfies IAgentMemoriesSpi

function toAgentMemory(dto: AgentMemoryDto): AgentMemory {
  return {
    id: dto.id,
    content: dto.content,
    origin: dto.origin,
    status: dto.status,
    sourceSessionId: dto.sourceSessionId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}
