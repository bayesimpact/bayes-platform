import {
  type AgentRevisionDto,
  AgentsRoutes,
  type AgentWithDraftDto,
} from "@caseai-connect/api-contracts"
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
  getAllWithDrafts: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentsRoutes.getAllWithDrafts.response>(
      AgentsRoutes.getAllWithDrafts.getPath(params),
    )
    return response.data.data.map(toAgent)
  },
  getAvailableModels: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof AgentsRoutes.getAvailableModels.response>(
      AgentsRoutes.getAvailableModels.getPath(params),
    )
    return response.data.data
  },
  createOne: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentsRoutes.createOne.response>(
      AgentsRoutes.createOne.getPath(params),
      { payload } satisfies typeof AgentsRoutes.createOne.request,
    )
    return toAgent(response.data.data)
  },
  duplicateOne: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof AgentsRoutes.duplicateOne.response>(
      AgentsRoutes.duplicateOne.getPath(params),
      { payload } satisfies typeof AgentsRoutes.duplicateOne.request,
    )
    return toAgent(response.data.data)
  },
  updateOne: async (params, payload) => {
    const axios = getAxiosInstance()
    const response = await axios.patch(AgentsRoutes.updateOne.getPath(params), {
      payload,
    } satisfies typeof AgentsRoutes.updateOne.request)
    return response.data.data
  },
  deleteOne: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.delete(AgentsRoutes.deleteOne.getPath(params))
    return response.data.data
  },
} satisfies IAgentsSpi

/** An agent that was never published, such as a fresh copy, has a draft and no current revision. */
const toAgent = (dto: AgentWithDraftDto): Agent => ({
  createdAt: dto.createdAt,
  id: dto.id,
  name: dto.name,
  projectId: dto.projectId,
  type: dto.type,
  permissions: dto.permissions,
  ...(dto.currentRevision && { currentRevision: toAgentRevision(dto.currentRevision) }),
  ...(dto.draftRevision && { draftRevision: toAgentRevision(dto.draftRevision) }),
})

const toAgentRevision = (dto: AgentRevisionDto): AgentRevisionDto => ({
  updatedAt: dto.updatedAt,
  name: dto.name,
  description: dto.description,
  number: dto.number,
})
