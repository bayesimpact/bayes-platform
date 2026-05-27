import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { AgentEmbedConfigDto, UpdateAgentEmbedConfigDto } from "./agent-embed-configs.dto"

const base = "organizations/:organizationId/projects/:projectId/agents/:agentId/embed-config"

export const AgentEmbedConfigsRoutes = {
  getOne: defineRoute<ResponseData<AgentEmbedConfigDto>>({
    method: "get",
    path: base,
  }),
  updateOne: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateAgentEmbedConfigDto>
  >({
    method: "patch",
    path: base,
  }),
}
