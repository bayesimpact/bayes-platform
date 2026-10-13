import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type {
  AgentSettingsDto,
  CreateAgentSettingsDto,
  PartialUpdateAgentSettingsDto,
} from "./agent-settings.dto"

export const AgentSettingsRoutes = {
  getAll: defineRoute<ResponseData<AgentSettingsDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings",
  }),
  getFillFormOutputJsonSchema: defineRoute<ResponseData<AgentSettingsDto["outputJsonSchema"]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings/:revision/output-json-schema",
  }),
  updateOne: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<PartialUpdateAgentSettingsDto>
  >({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/update-settings",
  }),
  restoreOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings/:revision/restore",
  }),
  createOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<CreateAgentSettingsDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings/:revision/createOne",
  }),
  archiveOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agents/:agentId/settings/:revision/archiveOne",
  }),
}
