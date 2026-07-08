import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { AgentDto, CreateAgentDto, PartialUpdateAgentDto } from "./agents.dto"

export const AgentsRoutes = {
  createOne: defineRoute<ResponseData<AgentDto>, RequestPayload<CreateAgentDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents",
  }),
  getAll: defineRoute<ResponseData<AgentDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents",
  }),
  updateOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<PartialUpdateAgentDto>>({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId",
  }),
}
