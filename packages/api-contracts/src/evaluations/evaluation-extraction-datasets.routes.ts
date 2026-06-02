import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  EvaluationExtractionDatasetDto,
  EvaluationExtractionDatasetFileColumnDto,
  EvaluationExtractionDatasetFileDto,
  EvaluationExtractionDatasetSchemaColumnDto,
  PaginatedEvaluationExtractionDatasetRecordsDto,
} from "./evaluation-extraction-datasets.dto"

const prefix = "organizations/:organizationId/projects/:projectId/evaluation-extraction-datasets"
export const EvaluationExtractionDatasetsRoutes = {
  getAllFiles: defineRoute<ResponseData<EvaluationExtractionDatasetFileDto[]>>({
    method: "get",
    path: `${prefix}/files`,
  }),
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
    path: `${prefix}/:datasetId/file/:documentId/update`,
  }),
  getFileColumns: defineRoute<ResponseData<EvaluationExtractionDatasetFileColumnDto[]>>({
    method: "get",
    path: `${prefix}/file/:documentId/columns`,
  }),
  renameOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<{ name: string }>>({
    method: "patch",
    path: `${prefix}/:datasetId/rename`,
  }),
}
