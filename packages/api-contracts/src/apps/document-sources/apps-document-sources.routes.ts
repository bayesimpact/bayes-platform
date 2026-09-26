import type { ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type { DocumentSourceDto } from "./apps-document-sources.dto"

export const AppsDocumentSourcesRoutes = {
  getAll: defineRoute<ResponseData<DocumentSourceDto[]>>({
    method: "get",
    path: "apps/v1/projects/:projectId/document-sources",
  }),
  getOne: defineRoute<ResponseData<DocumentSourceDto>>({
    method: "get",
    path: "apps/v1/projects/:projectId/document-sources/:id",
  }),
  createOne: defineRoute<ResponseData<DocumentSourceDto>>({
    method: "post",
    path: "apps/v1/projects/:projectId/document-sources",
  }),
  updateOne: defineRoute<ResponseData<DocumentSourceDto>>({
    method: "patch",
    path: "apps/v1/projects/:projectId/document-sources/:id",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "apps/v1/projects/:projectId/document-sources/:id",
  }),
}
