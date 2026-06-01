import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { ProjectAgentCategoryDto } from "../projects/projects.dto"
import type { CreateProjectAgentCategoryDto } from "./project-agent-categories.dto"

export const ProjectAgentCategoriesRoutes = {
  createOne: defineRoute<
    ResponseData<ProjectAgentCategoryDto>,
    RequestPayload<CreateProjectAgentCategoryDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agent-categories",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/agent-categories/:categoryId",
  }),
}
