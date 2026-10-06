import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../../generic"
import { defineRoute } from "../../helpers"
import type { BaseAgentSessionTypeDto } from "../conversation-agent-sessions/conversation-agent-sessions.dto"
import type {
  AgentCsvExtractionRunDto,
  AgentCsvExtractionRunStatusChangedEventDto,
  CreateAgentCsvExtractionRunRequestDto,
  ExecuteAgentCsvExtractionRunRequestDto,
  PaginatedAgentCsvExtractionRunRecordsDto,
} from "./agent-csv-extraction-runs.dto"

/** Live and playground runs each get their own route set, so each has its own permissions. */
function defineAgentCsvExtractionRunsRoutes(type: BaseAgentSessionTypeDto) {
  const prefix = `organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs/${type}`

  return {
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
    /** A temporary URL to download the run's results export, for whoever can read the run. */
    getExportTemporaryUrl: defineRoute<ResponseData<{ url: string }>>({
      method: "get",
      path: `${prefix}/:agentCsvExtractionRunId/export/temporary-url`,
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
}

export const AgentCsvExtractionRunsRoutes = {
  live: defineAgentCsvExtractionRunsRoutes("live"),
  playground: defineAgentCsvExtractionRunsRoutes("playground"),
}
