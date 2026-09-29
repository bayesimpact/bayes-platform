import type { ResponseData } from "../../generic"
import { defineRoute } from "../../helpers"
import type { AppDocumentCreatedDto, CreateAppDocumentResponseDto } from "./apps-documents.dto"

export const AppsDocumentsRoutes = {
  createOne: defineRoute<ResponseData<CreateAppDocumentResponseDto>>({
    method: "post",
    path: "apps/v1/projects/:projectId/documents",
  }),
  confirmOne: defineRoute<ResponseData<AppDocumentCreatedDto>>({
    method: "post",
    path: "apps/v1/projects/:projectId/documents/:documentId/confirm",
  }),
}
