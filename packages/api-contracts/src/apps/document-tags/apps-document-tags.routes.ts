import type { ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type { AppDocumentTagDto } from "./apps-document-tags.dto"

export const AppsDocumentTagsRoutes = {
  getAll: defineRoute<ResponseData<AppDocumentTagDto[]>>({
    method: "get",
    path: "apps/v1/projects/:projectId/document-tags",
  }),
  getOne: defineRoute<ResponseData<AppDocumentTagDto>>({
    method: "get",
    path: "apps/v1/projects/:projectId/document-tags/:id",
  }),
  createOne: defineRoute<ResponseData<AppDocumentTagDto>>({
    method: "post",
    path: "apps/v1/projects/:projectId/document-tags",
  }),
  updateOne: defineRoute<ResponseData<AppDocumentTagDto>>({
    method: "patch",
    path: "apps/v1/projects/:projectId/document-tags/:id",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "apps/v1/projects/:projectId/document-tags/:id",
  }),
}
