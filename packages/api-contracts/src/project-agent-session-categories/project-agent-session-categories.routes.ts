import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { ProjectAgentSessionCategoryDto } from "../projects/projects.dto"
import type { CreateProjectAgentSessionCategoryDto } from "./project-agent-session-categories.dto"

export const ProjectAgentSessionCategoriesRoutes = {
  createOne: defineRoute<
    ResponseData<ProjectAgentSessionCategoryDto>,
    RequestPayload<CreateProjectAgentSessionCategoryDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agent-session-categories",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/agent-session-categories/:categoryId",
  }),
}
