import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { ProjectSessionCategoryDto } from "../projects/projects.dto"
import type { CreateProjectSessionCategoryDto } from "./project-session-categories.dto"

export const ProjectSessionCategoriesRoutes = {
  createOne: defineRoute<
    ResponseData<ProjectSessionCategoryDto>,
    RequestPayload<CreateProjectSessionCategoryDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/session-categories",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/session-categories/:categoryId",
  }),
}
