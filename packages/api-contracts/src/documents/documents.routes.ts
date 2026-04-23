import type { DocumentTagsUpdateFieldsDto } from "../document-tags/document-tag.dto"
import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CrawlUrlRequestDto,
  CrawlUrlResponseDto,
  DocumentDto,
  DocumentUploadOptionalTagFields,
  PresignFileRequestItemDto,
  PresignFileResponseItemDto,
} from "./documents.dto"

export const DocumentsRoutes = {
  uploadOne: defineRoute<
    ResponseData<DocumentDto>,
    RequestPayload<{ file: File } & DocumentUploadOptionalTagFields>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/documents/:sourceType/upload/",
  }),
  presignMany: defineRoute<
    ResponseData<PresignFileResponseItemDto[]>,
    RequestPayload<{ files: PresignFileRequestItemDto[] }>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/documents/:sourceType/presign",
  }),
  confirmMany: defineRoute<
    ResponseData<DocumentDto[]>,
    RequestPayload<{ documentIds: string[] } & DocumentUploadOptionalTagFields>
  >({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/documents/confirm",
  }),
  getAll: defineRoute<ResponseData<DocumentDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/documents",
  }),
  listMyExtractionDocuments: defineRoute<ResponseData<DocumentDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/documents/extraction/mine",
  }),
  getTemporaryUrl: defineRoute<ResponseData<{ url: string }>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/documents/:documentId/temporary-url",
  }),
  updateOne: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<Partial<Pick<DocumentDto, "title">> & DocumentTagsUpdateFieldsDto>
  >({
    method: "patch",
    path: "organizations/:organizationId/projects/:projectId/documents/:documentId",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/documents/:documentId",
  }),
  reprocessOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/documents/:documentId/reprocess",
  }),
  crawlUrl: defineRoute<ResponseData<CrawlUrlResponseDto>, RequestPayload<CrawlUrlRequestDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/documents/crawl-url",
  }),
  // Streaming responses are sent as text/event-stream (SSE) and do not follow ResponseData<T>.
  streamEmbeddingStatus: defineRoute<ResponseData<unknown>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/documents/embedding-status/stream",
  }),
  streamCrawlProgress: defineRoute<ResponseData<unknown>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/documents/crawl-progress/stream",
  }),
}
