import { type AgentDto, AgentsRoutes, type AgentWithDraftDto } from "@caseai-connect/api-contracts"
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
    return response.data.data.map(toAgentWithDraft)
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

const toAgent = (dto: AgentDto): Agent => ({
  createdAt: dto.createdAt,
  id: dto.id,
  name: dto.name,
  projectId: dto.projectId,
  type: dto.type,
  currentRevision: {
    updatedAt: dto.currentRevision.updatedAt,
    name: dto.currentRevision.name,
    description: dto.currentRevision.description,
    number: dto.currentRevision.number,
  },
})

const toAgentWithDraft = (dto: AgentWithDraftDto): Agent => ({
  ...toAgent(dto),
  ...(dto.draftRevision && {
    draftRevision: {
      updatedAt: dto.draftRevision.updatedAt,
      name: dto.draftRevision.name,
      description: dto.draftRevision.description,
      number: dto.draftRevision.number,
    },
  }),
})
