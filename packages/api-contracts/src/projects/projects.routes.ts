import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { MyProjectDto, ProjectDto } from "./projects.dto"

export const ProjectsRoutes = {
  getAllMine: defineRoute<ResponseData<MyProjectDto[]>>({
    method: "get",
    path: "projects/mine",
  }),
  createOne: defineRoute<ResponseData<ProjectDto>, RequestPayload<Pick<ProjectDto, "name">>>({
    method: "post",
    path: "organizations/:organizationId/projects",
  }),
  getAll: defineRoute<ResponseData<ProjectDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects",
  }),
  updateOne: defineRoute<ResponseData<ProjectDto>, RequestPayload<Pick<ProjectDto, "name">>>({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId",
  }),
}
