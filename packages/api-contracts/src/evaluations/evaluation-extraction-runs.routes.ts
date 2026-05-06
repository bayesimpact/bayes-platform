import type { RequestPayload, ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreateEvaluationExtractionRunRequestDto,
  EvaluationExtractionRunDto,
  EvaluationExtractionRunStatusChangedEventDto,
  PaginatedEvaluationExtractionRunRecordsDto,
} from "./evaluation-extraction-runs.dto"

const prefix = "organizations/:organizationId/projects/:projectId/evaluation-extraction-runs"

export const EvaluationExtractionRunsRoutes = {
  createOne: defineRoute<
    ResponseData<EvaluationExtractionRunDto>,
    RequestPayload<CreateEvaluationExtractionRunRequestDto>
  >({
    method: "post",
    path: prefix,
  }),
  executeOne: defineRoute<ResponseData<EvaluationExtractionRunDto>>({
    method: "post",
    path: `${prefix}/:evaluationExtractionRunId/execute`,
  }),
  retryOne: defineRoute<ResponseData<EvaluationExtractionRunDto>>({
    method: "post",
    path: `${prefix}/:evaluationExtractionRunId/retry`,
  }),
  cancelOne: defineRoute<ResponseData<EvaluationExtractionRunDto>>({
    method: "post",
    path: `${prefix}/:evaluationExtractionRunId/cancel`,
  }),
  getOne: defineRoute<ResponseData<EvaluationExtractionRunDto>>({
    method: "get",
    path: `${prefix}/:evaluationExtractionRunId`,
  }),
  getAll: defineRoute<ResponseData<EvaluationExtractionRunDto[]>>({
    method: "get",
    path: prefix,
  }),
  getRecords: defineRoute<ResponseData<PaginatedEvaluationExtractionRunRecordsDto>>({
    method: "get",
    path: `${prefix}/:evaluationExtractionRunId/records`,
  }),
  streamRunStatus: defineRoute<EvaluationExtractionRunStatusChangedEventDto>({
    method: "get",
    path: `${prefix}/status/stream`,
  }),
}
