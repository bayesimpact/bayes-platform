import type { AgentCsvExtractionRunColumnSchemaDto } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { selectPlaygroundRevision } from "@/common/features/agents/agent-settings/agent-settings.selectors"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkConfig } from "@/common/store/types"
import { patchRunStatus } from "./agent-csv-extraction-runs.actions"
import type {
  AgentCsvExtractionRun,
  PaginatedAgentCsvExtractionRunRecords,
} from "./agent-csv-extraction-runs.models"

type ThunkConfigWithSignal = ThunkConfig & { serializedErrorType: Error }

function getAgentIds(state: RootState) {
  return {
    organizationId: getCurrentId({ state, name: "organizationId" }),
    projectId: getCurrentId({ state, name: "projectId" }),
    agentId: getCurrentId({ state, name: "agentId" }),
  }
}

const getRecords = createAsyncThunk<
  PaginatedAgentCsvExtractionRunRecords,
  {
    agentId: string
    agentCsvExtractionRunId: string
    page?: number
    limit?: number
    columnFilters?: Record<string, string>
    sortBy?: string
    sortOrder?: "asc" | "desc"
  },
  ThunkConfig
>(
  "agentCsvExtractionRuns/getRecords",
  async (
    { agentCsvExtractionRunId, page, limit, columnFilters, sortBy, sortOrder },
    { extra: { services }, getState },
  ) => {
    return await services.agentCsvExtractionRuns.getRecords({
      ...getAgentIds(getState()),
      agentCsvExtractionRunId,
      page,
      limit,
      columnFilters,
      sortBy,
      sortOrder,
    })
  },
)

const getFileColumns = createAsyncThunk<
  { id: string; name: string; values: unknown[] }[],
  { agentId: string; documentId: string },
  ThunkConfig
>(
  "agentCsvExtractionRuns/getFileColumns",
  async ({ documentId }, { extra: { services }, getState }) => {
    return await services.agentCsvExtractionRuns.getFileColumns({
      ...getAgentIds(getState()),
      documentId,
    })
  },
)

const uploadCsvFile = createAsyncThunk<
  string,
  { file: File; onSuccess: (documentId: string) => void },
  ThunkConfig
>(
  "agentCsvExtractionRuns/uploadCsvFile",
  async ({ file, onSuccess }, { extra: { services }, getState }) => {
    // Through the extraction agent, like any run document: the run documents are not project
    // documents.
    const document = await services.extractionAgentSessions.uploadDocument({
      ...getAgentIds(getState()),
      file,
    })
    onSuccess(document.id)
    return document.id
  },
)

const createAndExecute = createAsyncThunk<
  AgentCsvExtractionRun,
  {
    agentId: string
    documentId: string
    columnSchema: AgentCsvExtractionRunColumnSchemaDto
    recordLimit: number | null
    onSuccess: (runId: string) => void
  },
  ThunkConfig
>(
  "agentCsvExtractionRuns/createAndExecute",
  async (
    { documentId, columnSchema, recordLimit, onSuccess },
    { extra: { services }, getState },
  ) => {
    const state = getState()
    const params = getAgentIds(state)
    // The version the playground runs. `undefined` while the history is loading, so the API
    // applies its own default.
    const agentSettingsRevision = selectPlaygroundRevision({ agentId: params.agentId })(state)

    const run = await services.agentCsvExtractionRuns.createOne({
      ...params,
      payload: {
        csvDocumentId: documentId,
        columnSchema,
        agentSettingsRevision,
      },
    })
    await services.agentCsvExtractionRuns.executeOne({
      ...params,
      agentCsvExtractionRunId: run.id,
      recordLimit,
    })
    onSuccess(run.id)
    return run
  },
)

const retryOne = createAsyncThunk<
  AgentCsvExtractionRun,
  { agentId: string; agentCsvExtractionRunId: string },
  ThunkConfig
>(
  "agentCsvExtractionRuns/retryOne",
  async ({ agentCsvExtractionRunId }, { extra: { services }, getState }) => {
    return await services.agentCsvExtractionRuns.retryOne({
      ...getAgentIds(getState()),
      agentCsvExtractionRunId,
    })
  },
)

const cancelOne = createAsyncThunk<
  AgentCsvExtractionRun,
  { agentId: string; agentCsvExtractionRunId: string },
  ThunkConfig
>(
  "agentCsvExtractionRuns/cancelOne",
  async ({ agentCsvExtractionRunId }, { extra: { services }, getState }) => {
    return await services.agentCsvExtractionRuns.cancelOne({
      ...getAgentIds(getState()),
      agentCsvExtractionRunId,
    })
  },
)

const deleteOne = createAsyncThunk<void, { agentCsvExtractionRunId: string }, ThunkConfig>(
  "agentCsvExtractionRuns/deleteOne",
  async ({ agentCsvExtractionRunId }, { extra: { services }, getState }) => {
    await services.agentCsvExtractionRuns.deleteOne({
      ...getAgentIds(getState()),
      agentCsvExtractionRunId,
    })
  },
)

const getExportTemporaryUrl = createAsyncThunk<
  { url: string },
  { agentCsvExtractionRunId: string },
  ThunkConfig
>(
  "agentCsvExtractionRuns/getExportTemporaryUrl",
  async ({ agentCsvExtractionRunId }, { extra: { services }, getState }) => {
    return await services.agentCsvExtractionRuns.getExportTemporaryUrl({
      ...getAgentIds(getState()),
      agentCsvExtractionRunId,
    })
  },
)

const streamRunStatus = createAsyncThunk<void, void, ThunkConfigWithSignal>(
  "agentCsvExtractionRuns/streamRunStatus",
  async (_, { extra: { services }, getState, dispatch, signal }) => {
    const params = getAgentIds(getState())
    await services.agentCsvExtractionRuns.streamRunStatus({
      ...params,
      signal,
      onStatusChanged: (event) => {
        dispatch(
          patchRunStatus({
            agentCsvExtractionRunId: event.agentCsvExtractionRunId,
            status: event.status,
            summary: event.summary,
            updatedAt: event.updatedAt,
          }),
        )
      },
    })
  },
)

export const agentCsvExtractionRunsThunks = {
  cancelOne,
  createAndExecute,
  deleteOne,
  getExportTemporaryUrl,
  retryOne,
  getFileColumns,
  getRecords,
  streamRunStatus,
  uploadCsvFile,
}
