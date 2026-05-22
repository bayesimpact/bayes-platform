import { type AgentEmbedConfigDto, AgentEmbedConfigsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AgentEmbedConfig } from "../agent-embed-configs.models"
import type { IAgentEmbedConfigsSpi } from "../agent-embed-configs.spi"

export default {
  getOne: async ({ organizationId, projectId, agentId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentEmbedConfigsRoutes.getOne.response>(
      AgentEmbedConfigsRoutes.getOne.getPath({ organizationId, projectId, agentId }),
    )
    return fromDto(response.data.data)
  },
  updateOne: async ({ organizationId, projectId, agentId }, payload) => {
    const axios = getAxiosInstance()
    await axios.patch(
      AgentEmbedConfigsRoutes.updateOne.getPath({ organizationId, projectId, agentId }),
      { payload },
    )
  },
} satisfies IAgentEmbedConfigsSpi

const fromDto = (dto: AgentEmbedConfigDto): AgentEmbedConfig => ({
  id: dto.id,
  agentId: dto.agentId,
  embedToken: dto.embedToken,
  isEnabled: dto.isEnabled,
  allowedOrigins: dto.allowedOrigins,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
})
