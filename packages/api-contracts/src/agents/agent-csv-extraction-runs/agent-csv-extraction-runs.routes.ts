import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type {
  AgentCsvExtractionRunDto,
  AgentCsvExtractionRunStatusChangedEventDto,
  CreateAgentCsvExtractionRunRequestDto,
  ExecuteAgentCsvExtractionRunRequestDto,
  PaginatedAgentCsvExtractionRunRecordsDto,
} from "./agent-csv-extraction-runs.dto"

const prefix =
  "organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs"

export const AgentCsvExtractionRunsRoutes = {
  createOne: defineRoute<
    ResponseData<AgentCsvExtractionRunDto>,
    RequestPayload<CreateAgentCsvExtractionRunRequestDto>
  >({
    method: "post",
    path: prefix,
  }),
  executeOne: defineRoute<
    ResponseData<AgentCsvExtractionRunDto>,
    RequestPayload<ExecuteAgentCsvExtractionRunRequestDto>
  >({
    method: "post",
    path: `${prefix}/:agentCsvExtractionRunId/execute`,
  }),
  retryOne: defineRoute<ResponseData<AgentCsvExtractionRunDto>>({
    method: "post",
    path: `${prefix}/:agentCsvExtractionRunId/retry`,
  }),
  cancelOne: defineRoute<ResponseData<AgentCsvExtractionRunDto>>({
    method: "post",
    path: `${prefix}/:agentCsvExtractionRunId/cancel`,
  }),
  getOne: defineRoute<ResponseData<AgentCsvExtractionRunDto>>({
    method: "get",
    path: `${prefix}/:agentCsvExtractionRunId`,
  }),
  getAll: defineRoute<ResponseData<AgentCsvExtractionRunDto[]>>({
    method: "get",
    path: prefix,
  }),
  getRecords: defineRoute<ResponseData<PaginatedAgentCsvExtractionRunRecordsDto>>({
    method: "get",
    path: `${prefix}/:agentCsvExtractionRunId/records`,
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: `${prefix}/:agentCsvExtractionRunId`,
  }),
  streamRunStatus: defineRoute<AgentCsvExtractionRunStatusChangedEventDto>({
    method: "get",
    path: `${prefix}/status/stream`,
  }),
  getFileColumns: defineRoute<ResponseData<{ id: string; name: string; values: unknown[] }[]>>({
    method: "get",
    path: `${prefix}/file/:documentId/columns`,
  }),
}
