import { type AgentSettingsDto, AgentSettingsRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { AgentSettings } from "../agent-settings.models"
import type { IAgentSettingsSpi } from "../agent-settings.spi"

export default {
  updateOne: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.patch(AgentSettingsRoutes.updateOne.getPath(params), {
      payload,
    } satisfies typeof AgentSettingsRoutes.updateOne.request)
    return response.data.data
  },
  getAllWithDraft: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentSettingsRoutes.getAllWithDraft.response>(
      AgentSettingsRoutes.getAllWithDraft.getPath(params),
    )
    return response.data.data.map(toAgentSettings)
  },
  restoreOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.post(
      AgentSettingsRoutes.restoreOne.getPath(sanitizeParams(params)),
    )
    return response.data.data
  },
  createOne: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentSettingsRoutes.createOne.response>(
      AgentSettingsRoutes.createOne.getPath(sanitizeParams(params)),
      { payload } satisfies typeof AgentSettingsRoutes.createOne.request,
    )
    return response.data.data
  },
  getFillFormOutputJsonSchema: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<
      typeof AgentSettingsRoutes.getFillFormOutputJsonSchema.response
    >(AgentSettingsRoutes.getFillFormOutputJsonSchema.getPath(sanitizeParams(params)))
    return response.data.data
  },
} satisfies IAgentSettingsSpi

function sanitizeParams(params: {
  organizationId: string
  projectId: string
  agentId: string
  revision: number
}) {
  return {
    organizationId: String(params.organizationId),
    projectId: String(params.projectId),
    agentId: String(params.agentId),
    ...(params.revision !== undefined ? { revision: String(params.revision) } : {}),
  }
}

const toAgentSettings = (dto: AgentSettingsDto): AgentSettings => ({
  agentId: dto.agentId,
  createdAt: dto.createdAt,
  description: dto.description,
  documentsRagMode: dto.documentsRagMode,
  documentTagIds: dto.documentTagIds,
  embeddingModel: dto.embeddingModel,
  fillFormEnabled: dto.fillFormEnabled,
  priorityCallsEnabled: dto.priorityCallsEnabled,
  greetingMessage: dto.greetingMessage,
  hasCategories: dto.hasCategories,
  id: dto.id,
  instructions: dto.instructions,
  isArchived: dto.isArchived,
  isDraft: dto.isDraft,
  locale: dto.locale,
  mcpServers: dto.mcpServers,
  model: dto.model,
  name: dto.name,
  outputJsonSchema: dto.outputJsonSchema,
  projectAgentSessionCategoryIds: dto.projectAgentSessionCategoryIds,
  resourceLibraryIds: dto.resourceLibraryIds,
  revision: dto.revision,
  temperature: dto.temperature,
  updatedAt: dto.updatedAt,
  usedProjectAgentSessionCategoryIds: dto.usedProjectAgentSessionCategoryIds,
  thinkingLevel: dto.thinkingLevel,
})
