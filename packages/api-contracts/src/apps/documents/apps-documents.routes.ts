import type { ResponseData } from "../../generic"
import { defineRoute } from "../../helpers"
import type { CreateAppDocumentResponseDto } from "./apps-documents.dto"

export const AppsDocumentsRoutes = {
  createOne: defineRoute<ResponseData<CreateAppDocumentResponseDto>>({
    method: "post",
    path: "apps/v1/projects/:projectId/documents",
  }),
}
