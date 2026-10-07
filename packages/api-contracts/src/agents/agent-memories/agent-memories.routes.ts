import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type { AgentMemoryDto, ResolveAgentMemoryProposalsDto } from "./agent-memories.dto"

// Every route acts on the caller's own memories with this agent: the API never
// lists or deletes another user's facts. `:sessionType` is `playground` or `live`.
const basePath =
  "organizations/:organizationId/projects/:projectId/agents/:agentId/memories/:sessionType"

export const AgentMemoriesRoutes = {
  getAll: defineRoute<ResponseData<AgentMemoryDto[]>>({
    method: "get",
    path: basePath,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${basePath}/:memoryId`,
  }),
  deleteAll: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: basePath,
  }),
  resolveProposals: defineRoute<
    ResponseData<AgentMemoryDto[]>,
    RequestPayload<ResolveAgentMemoryProposalsDto>
  >({
    method: "post",
    path: `${basePath}/resolve-proposals`,
  }),
}
