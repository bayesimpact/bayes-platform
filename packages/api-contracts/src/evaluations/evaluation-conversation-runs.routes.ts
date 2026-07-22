import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreateEvaluationConversationRunRequestDto,
  EvaluationConversationRunDto,
  EvaluationConversationRunStatusChangedEventDto,
  ExecuteEvaluationConversationRunRequestDto,
  PaginatedEvaluationConversationRunRecordsDto,
} from "./evaluation-conversation-runs.dto"

const prefix = "organizations/:organizationId/projects/:projectId/evaluation-conversation-runs"

export const EvaluationConversationRunsRoutes = {
  createOne: defineRoute<
    ResponseData<EvaluationConversationRunDto>,
    RequestPayload<CreateEvaluationConversationRunRequestDto>
  >({
    method: "post",
    path: prefix,
  }),
  executeOne: defineRoute<
    ResponseData<EvaluationConversationRunDto>,
    RequestPayload<ExecuteEvaluationConversationRunRequestDto>
  >({
    method: "post",
    path: `${prefix}/:evaluationConversationRunId/execute`,
  }),
  retryOne: defineRoute<ResponseData<EvaluationConversationRunDto>>({
    method: "post",
    path: `${prefix}/:evaluationConversationRunId/retry`,
  }),
  cancelOne: defineRoute<ResponseData<EvaluationConversationRunDto>>({
    method: "post",
    path: `${prefix}/:evaluationConversationRunId/cancel`,
  }),
  getOne: defineRoute<ResponseData<EvaluationConversationRunDto>>({
    method: "get",
    path: `${prefix}/:evaluationConversationRunId`,
  }),
  getAll: defineRoute<ResponseData<EvaluationConversationRunDto[]>>({
    method: "get",
    path: prefix,
  }),
  getRecords: defineRoute<ResponseData<PaginatedEvaluationConversationRunRecordsDto>>({
    method: "get",
    path: `${prefix}/:evaluationConversationRunId/records`,
  }),
  streamRunStatus: defineRoute<EvaluationConversationRunStatusChangedEventDto>({
    method: "get",
    path: `${prefix}/status/stream`,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${prefix}/:evaluationConversationRunId`,
  }),
}
