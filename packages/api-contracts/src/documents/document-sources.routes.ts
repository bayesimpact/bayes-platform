import type { DocumentTagsUpdateFieldsDto } from "../document-tags/document-tag.dto"
import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { DocumentSourceSummaryDto } from "./documents.dto"

export const DocumentSourcesRoutes = {
  getAll: defineRoute<ResponseData<DocumentSourceSummaryDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/document-sources",
  }),
  updateOne: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<DocumentTagsUpdateFieldsDto>
  >({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/document-sources/:documentSourceId",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/document-sources/:documentSourceId",
  }),
}
