import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  EvaluationExtractionDatasetDto,
  EvaluationExtractionDatasetFileColumnDto,
  EvaluationExtractionDatasetFileDto,
  EvaluationExtractionDatasetSchemaColumnDto,
  PaginatedEvaluationExtractionDatasetRecordsDto,
  PresignEvaluationExtractionDatasetFileRequestDto,
  PresignEvaluationExtractionDatasetFileResponseDto,
} from "./evaluation-extraction-datasets.dto"

const prefix = "organizations/:organizationId/projects/:projectId/evaluation-extraction-datasets"
export const EvaluationExtractionDatasetsRoutes = {
  // Files: presign → PUT to the signed URL → confirm, like project documents.
  getAllFiles: defineRoute<ResponseData<EvaluationExtractionDatasetFileDto[]>>({
    method: "get",
    path: `${prefix}/files`,
  }),
  presignFile: defineRoute<
    ResponseData<PresignEvaluationExtractionDatasetFileResponseDto>,
    RequestPayload<PresignEvaluationExtractionDatasetFileRequestDto>
  >({
    method: "post",
    path: `${prefix}/files/presign`,
  }),
  confirmFile: defineRoute<ResponseData<EvaluationExtractionDatasetFileDto>>({
    method: "post",
    path: `${prefix}/files/:documentId/confirm`,
  }),
  getFileColumns: defineRoute<ResponseData<EvaluationExtractionDatasetFileColumnDto[]>>({
    method: "get",
    path: `${prefix}/files/:documentId/columns`,
  }),
  deleteFile: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${prefix}/files/:documentId`,
  }),

  // Datasets
  getAll: defineRoute<ResponseData<EvaluationExtractionDatasetDto[]>>({
    method: "get",
    path: prefix,
  }),
  getRecords: defineRoute<ResponseData<PaginatedEvaluationExtractionDatasetRecordsDto>>({
    method: "get",
    path: `${prefix}/:datasetId/records`,
  }),
  createOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<{ name: string }>>({
    method: "post",
    path: `${prefix}/createOne`,
  }),
  updateOne: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<{
      name: string
      columns: EvaluationExtractionDatasetSchemaColumnDto[]
    }>
  >({
    method: "patch",
    path: `${prefix}/:datasetId/files/:documentId/update`,
  }),
  renameOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<{ name: string }>>({
    method: "patch",
    path: `${prefix}/:datasetId/rename`,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${prefix}/:datasetId`,
  }),
}
