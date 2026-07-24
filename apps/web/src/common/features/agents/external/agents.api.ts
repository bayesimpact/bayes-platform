import { type AgentDto, AgentHistoryRoutes, AgentsRoutes } from "@caseai-connect/api-contracts"
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
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    await axios.delete(AgentsRoutes.deleteOne.getPath(params))
  },
  getHistory: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentHistoryRoutes.getAll.response>(
      AgentHistoryRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toAgent)
  },
  restoreRevision: async ({ revision, ...params }) => {
    const axios = getAxiosInstance()
    await axios.post(
      AgentHistoryRoutes.restoreOne.getPath({ ...params, revision: String(revision) }),
    )
  },
} satisfies IAgentsSpi

const toAgent = (dto: AgentDto): Agent => ({
  createdAt: dto.createdAt,
  instructions: dto.instructions,
  documentsRagMode: dto.documentsRagMode,
  greetingMessage: dto.greetingMessage,
  hasCategories: dto.hasCategories ?? false,
  id: dto.id,
  revision: dto.revision ?? 1,
  locale: dto.locale,
  model: dto.model,
  name: dto.name,
  outputJsonSchema: dto.outputJsonSchema,
  projectId: dto.projectId,
  temperature: dto.temperature,
  type: dto.type,
  updatedAt: dto.updatedAt,
  documentTagIds: dto.documentTagIds,
  resourceLibraryIds: dto.resourceLibraryIds,
  fillFormEnabled: dto.fillFormEnabled,
  projectAgentSessionCategoryIds: dto.projectAgentSessionCategoryIds,
  usedProjectAgentSessionCategoryIds: dto.usedProjectAgentSessionCategoryIds,
  mcpServers: dto.mcpServers,
})
