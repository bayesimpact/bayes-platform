import type { ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { DocumentSourceSummaryDto } from "./documents.dto"

export const DocumentSourcesRoutes = {
  getAll: defineRoute<ResponseData<DocumentSourceSummaryDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/document-sources",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/document-sources/:documentSourceId",
  }),
}
