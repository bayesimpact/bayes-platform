import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type { PublishAgentDto } from "../agents.dto"
import type { AgentSettingsDto, UpdateAgentSettingsDto } from "./agent-settings.dto"

export const AgentSettingsRoutes = {
  getAll: defineRoute<ResponseData<AgentSettingsDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings",
  }),
  updateOne: defineRoute<ResponseData<AgentSettingsDto>, RequestPayload<UpdateAgentSettingsDto>>({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings",
  }),
  restoreOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings/:revision/restore",
  }),
  publishOne: defineRoute<ResponseData<AgentSettingsDto>, RequestPayload<PublishAgentDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings/:revision/publishOne",
  }),
  archiveOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings/:revision/archiveOne",
  }),
}
