import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { ProjectDto, UpdateProjectRequestDto } from "./projects.dto"

export const ProjectsRoutes = {
  createOne: defineRoute<ResponseData<ProjectDto>, RequestPayload<Pick<ProjectDto, "name">>>({
    method: "post",
    path: "organizations/:organizationId/projects",
  }),
  getAll: defineRoute<ResponseData<ProjectDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects",
  }),
  updateOne: defineRoute<ResponseData<ProjectDto>, RequestPayload<UpdateProjectRequestDto>>({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId",
  }),
}
