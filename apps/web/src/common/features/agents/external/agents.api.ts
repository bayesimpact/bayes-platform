import { type AgentDto, AgentsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { Agent } from "../agents.models"
import type { IAgentsSpi } from "../agents.spi"

export default {
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentsRoutes.getAll.response>(
      AgentsRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toAgent)
  },
  createOne: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentsRoutes.createOne.response>(
      AgentsRoutes.createOne.getPath(params),
      { payload } satisfies typeof AgentsRoutes.createOne.request,
    )
    return toAgent(response.data.data)
  },
  updateOne: async (params, payload) => {
    const axios = getAxiosInstance()
    await axios.patch(AgentsRoutes.updateOne.getPath(params), {
      payload,
    } satisfies typeof AgentsRoutes.updateOne.request)
  },
  updateDocumentTags: async (params, payload) => {
    const axios = getAxiosInstance()
    await axios.put(AgentsRoutes.updateDocumentTags.getPath(params), {
      payload,
    } satisfies typeof AgentsRoutes.updateDocumentTags.request)
  },
  updateResourceLibraries: async (params, payload) => {
    const axios = getAxiosInstance()
    await axios.put(AgentsRoutes.updateResourceLibraries.getPath(params), {
      payload,
    } satisfies typeof AgentsRoutes.updateResourceLibraries.request)
  },
  updateSessionCategories: async (params, payload) => {
    const axios = getAxiosInstance()
    await axios.put(AgentsRoutes.updateSessionCategories.getPath(params), {
      payload,
    } satisfies typeof AgentsRoutes.updateSessionCategories.request)
  },
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete(AgentsRoutes.deleteOne.getPath(params))
  },
} satisfies IAgentsSpi

const toAgent = (dto: AgentDto): Agent => ({
  id: dto.id,
  projectId: dto.projectId,
  name: dto.name,
  type: dto.type,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  hasCategories: dto.hasCategories ?? false,
  documentTagIds: dto.documentTagIds,
  resourceLibraryIds: dto.resourceLibraryIds,
  projectAgentSessionCategoryIds: dto.projectAgentSessionCategoryIds,
  usedProjectAgentSessionCategoryIds: dto.usedProjectAgentSessionCategoryIds,
  mcpServers: dto.mcpServers,
})
