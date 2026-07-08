import {
  type FormAgentSessionDto,
  FormAgentSessionsRoutes,
  type FormSubSessionDto,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { FormAgentSession, FormSubSession } from "../form-agent-sessions.models"
import type { IFormAgentSessionsSpi } from "../form-agent-sessions.spi"

export default {
  getAll: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof FormAgentSessionsRoutes.getAll.response>(
      FormAgentSessionsRoutes.getAll.getPath(params),
      { payload: { type } } satisfies typeof FormAgentSessionsRoutes.getAll.request,
    )
    return response.data.data.map(fromDto)
  },
  createOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof FormAgentSessionsRoutes.createOne.response>(
      FormAgentSessionsRoutes.createOne.getPath(params),
      { payload: { type } } satisfies typeof FormAgentSessionsRoutes.createOne.request,
    )
    return fromDto(response.data.data)
  },
  deleteOne: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof FormAgentSessionsRoutes.deleteOne.response>(
      FormAgentSessionsRoutes.deleteOne.getPath(params),
      { payload: { type } } satisfies typeof FormAgentSessionsRoutes.deleteOne.request,
    )
    return response.data.data
  },
  listSubSessions: async ({ type, ...params }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof FormAgentSessionsRoutes.listSubSessions.response>(
      FormAgentSessionsRoutes.listSubSessions.getPath(params),
      { payload: { type } } satisfies typeof FormAgentSessionsRoutes.listSubSessions.request,
    )
    return response.data.data.map(fromSubSessionDto)
  },
} satisfies IFormAgentSessionsSpi

const fromDto = (dto: FormAgentSessionDto): FormAgentSession => ({
  agentId: dto.agentId,
  createdAt: dto.createdAt,
  id: dto.id,
  result: dto.result,
  traceUrl: dto.traceUrl,
  type: dto.type,
  updatedAt: dto.updatedAt,
})

const fromSubSessionDto = (dto: FormSubSessionDto): FormSubSession => ({
  toolName: dto.toolName,
  agentId: dto.agentId,
  agentName: dto.agentName,
  outputJsonSchema: dto.outputJsonSchema,
  session: fromDto(dto.session),
})
