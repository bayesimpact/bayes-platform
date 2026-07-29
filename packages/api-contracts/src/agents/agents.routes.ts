import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AgentDto,
  CreateAgentDto,
  PartialUpdateAgentDto,
  UpdateAgentDocumentTagsDto,
  UpdateAgentResourceLibrariesDto,
  UpdateAgentSessionCategoriesDto,
} from "./agents.dto"

const AGENTS_PATH = "organizations/:organizationId/projects/:projectId/agents"
const AGENT_PATH = `${AGENTS_PATH}/:agentId`

export const AgentsRoutes = {
  createOne: defineRoute<ResponseData<AgentDto>, RequestPayload<CreateAgentDto>>({
    method: "post",
    path: AGENTS_PATH,
  }),
  getAll: defineRoute<ResponseData<AgentDto[]>>({
    method: "get",
    path: AGENTS_PATH,
  }),
  updateOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<PartialUpdateAgentDto>>({
    method: "patch",
    path: AGENT_PATH,
  }),
  updateDocumentTags: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateAgentDocumentTagsDto>
  >({
    method: "put",
    path: `${AGENT_PATH}/document-tags`,
  }),
  updateResourceLibraries: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateAgentResourceLibrariesDto>
  >({
    method: "put",
    path: `${AGENT_PATH}/resource-libraries`,
  }),
  updateSessionCategories: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateAgentSessionCategoriesDto>
  >({
    method: "put",
    path: `${AGENT_PATH}/session-categories`,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: AGENT_PATH,
  }),
}
