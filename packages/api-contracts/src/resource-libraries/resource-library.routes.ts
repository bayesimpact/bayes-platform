import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreateResourceDto,
  CreateResourceLibraryDto,
  ResourceLibraryDto,
  UpdateResourceDto,
  UpdateResourceLibraryDto,
  UploadResourceFileResponseDto,
} from "./resource-library.dto"

export const ResourceLibrariesRoutes = {
  createOne: defineRoute<
    ResponseData<ResourceLibraryDto>,
    RequestPayload<CreateResourceLibraryDto>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/resource-libraries",
  }),
  getAll: defineRoute<ResponseData<ResourceLibraryDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/resource-libraries",
  }),
  updateOne: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateResourceLibraryDto>
  >({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/resource-libraries/:resourceLibraryId",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/resource-libraries/:resourceLibraryId",
  }),
  addResource: defineRoute<ResponseData<ResourceLibraryDto>, RequestPayload<CreateResourceDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/resource-libraries/:resourceLibraryId/resources",
  }),
  updateResource: defineRoute<ResponseData<ResourceLibraryDto>, RequestPayload<UpdateResourceDto>>({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/resource-libraries/:resourceLibraryId/resources/:resourceId",
  }),
  deleteResource: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/resource-libraries/:resourceLibraryId/resources/:resourceId",
  }),
  uploadResourceFile: defineRoute<
    ResponseData<UploadResourceFileResponseDto>,
    RequestPayload<{ file: File }>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/resource-libraries/files/upload",
  }),
  // Redirects (302) to a freshly signed URL; not a JSON response.
  downloadResourceFile: defineRoute<ResponseData<unknown>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/resource-libraries/:resourceLibraryId/resources/:resourceId/file",
  }),
}
