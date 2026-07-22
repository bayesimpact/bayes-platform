import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  BulkCreateEvaluationConversationDatasetRecordsRequestDto,
  CreateEvaluationConversationDatasetRecordRequestDto,
  EvaluationConversationDatasetDto,
  PaginatedEvaluationConversationDatasetRecordsDto,
  UpdateEvaluationConversationDatasetRecordRequestDto,
} from "./evaluation-conversation-datasets.dto"

const prefix = "organizations/:organizationId/projects/:projectId/evaluation-conversation-datasets"
export const EvaluationConversationDatasetsRoutes = {
  getAll: defineRoute<ResponseData<EvaluationConversationDatasetDto[]>>({
    method: "get",
    path: prefix,
  }),
  getRecords: defineRoute<ResponseData<PaginatedEvaluationConversationDatasetRecordsDto>>({
    method: "get",
    path: `${prefix}/:datasetId/records`,
  }),
  createOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<{ name: string }>>({
    method: "post",
    path: `${prefix}/createOne`,
  }),
  renameOne: defineRoute<ResponseData<SuccessResponseDTO>, RequestPayload<{ name: string }>>({
    method: "patch",
    path: `${prefix}/:datasetId/rename`,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${prefix}/:datasetId`,
  }),
  createRecord: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<CreateEvaluationConversationDatasetRecordRequestDto>
  >({
    method: "post",
    path: `${prefix}/:datasetId/records`,
  }),
  createRecords: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<BulkCreateEvaluationConversationDatasetRecordsRequestDto>
  >({
    method: "post",
    path: `${prefix}/:datasetId/records/bulk`,
  }),
  updateRecord: defineRoute<
    ResponseData<SuccessResponseDTO>,
    RequestPayload<UpdateEvaluationConversationDatasetRecordRequestDto>
  >({
    method: "patch",
    path: `${prefix}/:datasetId/records/:recordId`,
  }),
  deleteRecord: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${prefix}/:datasetId/records/:recordId`,
  }),
}
