import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AgentDto,
  AgentWithDraftDto,
  CreateAgentDto,
  DuplicateAgentDto,
  UpdateAgentNameDto,
} from "./agents.dto"

export const AgentsRoutes = {
  createOne: defineRoute<ResponseData<AgentDto>, RequestPayload<CreateAgentDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents",
  }),
  /** Copies the agent into a new agent of the project, whose settings start as a draft. */
  duplicateOne: defineRoute<ResponseData<AgentWithDraftDto>, RequestPayload<DuplicateAgentDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/duplicate",
  }),
  getAll: defineRoute<ResponseData<AgentDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents",
  }),
  getAllWithDrafts: defineRoute<ResponseData<AgentWithDraftDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents-with-drafts",
  }),
  updateOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<UpdateAgentNameDto>>({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId",
  }),
}
