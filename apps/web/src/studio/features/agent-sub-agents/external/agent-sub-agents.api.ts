import { AgentSubAgentsRoutes, type AgentSubAgentDto } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AgentSubAgent } from "../agent-sub-agents.models"
import type { IAgentSubAgentsSpi } from "../agent-sub-agents.spi"

export default {
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentSubAgentsRoutes.getAll.response>(
      AgentSubAgentsRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toAgentSubAgent)
  },
  updateAll: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.put<typeof AgentSubAgentsRoutes.updateAll.response>(
      AgentSubAgentsRoutes.updateAll.getPath(params),
      { payload } satisfies typeof AgentSubAgentsRoutes.updateAll.request,
    )
    return response.data.data.map(toAgentSubAgent)
  },
} satisfies IAgentSubAgentsSpi

const toAgentSubAgent = (dto: AgentSubAgentDto): AgentSubAgent => ({
  id: dto.id,
  parentAgentId: dto.parentAgentId,
  childAgentId: dto.childAgentId,
  toolName: dto.toolName,
  description: dto.description,
  enabled: dto.enabled,
  childAgent: dto.childAgent,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
})
