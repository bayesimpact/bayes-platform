import type { EvaluationExtractionRunKeyMappingEntryDto } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { ThunkConfig } from "@/common/store/types"
import type {
  EvaluationExtractionRun,
  PaginatedEvaluationExtractionRunRecords,
} from "./evaluation-extraction-runs.models"
import { evaluationExtractionRunsActions } from "./evaluation-extraction-runs.slice"

type ThunkConfigWithSignal = ThunkConfig & { serializedErrorType: Error }

const getAll = createAsyncThunk<EvaluationExtractionRun[], void, ThunkConfig>(
  "evaluationExtractionRuns/getAll",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationExtractionRuns.getAll(params)
  },
)

const getOne = createAsyncThunk<
  EvaluationExtractionRun,
  { evaluationExtractionRunId: string },
  ThunkConfig
>(
  "evaluationExtractionRuns/getOne",
  async ({ evaluationExtractionRunId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationExtractionRuns.getOne({
      ...params,
      evaluationExtractionRunId,
    })
  },
)

const getRecords = createAsyncThunk<
  PaginatedEvaluationExtractionRunRecords,
  {
    evaluationExtractionRunId: string
    page?: number
    limit?: number
    columnFilters?: Record<string, string>
    sortBy?: string
    sortOrder?: "asc" | "desc"
  },
  ThunkConfig
>(
  "evaluationExtractionRuns/getRecords",
  async (
    { evaluationExtractionRunId, page, limit, columnFilters, sortBy, sortOrder },
    { extra: { services }, getState },
  ) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.evaluationExtractionRuns.getRecords({
      organizationId,
      projectId,
      evaluationExtractionRunId,
      page,
      limit,
      columnFilters,
      sortBy,
      sortOrder,
    })
  },
)

const createAndExecute = createAsyncThunk<
  EvaluationExtractionRun,
  {
    evaluationExtractionDatasetId: string
    agentId: string
    keyMapping: EvaluationExtractionRunKeyMappingEntryDto[]
    recordLimit: number | null
  },
  ThunkConfig
>(
  "evaluationExtractionRuns/createAndExecute",
  async (payload, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }

    const run = await services.evaluationExtractionRuns.createOne({
      ...params,
      payload: {
        evaluationExtractionDatasetId: payload.evaluationExtractionDatasetId,
        agentId: payload.agentId,
        keyMapping: payload.keyMapping,
      },
    })
    await services.evaluationExtractionRuns.executeOne({
      ...params,
      evaluationExtractionRunId: run.id,
      recordLimit: payload.recordLimit,
    })
    return run
  },
)

const retryOne = createAsyncThunk<
  EvaluationExtractionRun,
  {
    evaluationExtractionRunId: string
  },
  ThunkConfig
>(
  "evaluationExtractionRuns/retryOne",
  async ({ evaluationExtractionRunId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationExtractionRuns.retryOne({
      ...params,
      evaluationExtractionRunId,
    })
  },
)

const cancelOne = createAsyncThunk<
  EvaluationExtractionRun,
  { evaluationExtractionRunId: string },
  ThunkConfig
>(
  "evaluationExtractionRuns/cancelOne",
  async ({ evaluationExtractionRunId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationExtractionRuns.cancelOne({
      ...params,
      evaluationExtractionRunId,
    })
  },
)

const deleteOne = createAsyncThunk<void, { evaluationExtractionRunId: string }, ThunkConfig>(
  "evaluationExtractionRuns/deleteOne",
  async ({ evaluationExtractionRunId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.evaluationExtractionRuns.deleteOne({
      organizationId,
      projectId,
      evaluationExtractionRunId,
    })
  },
)

const streamRunStatus = createAsyncThunk<void, void, ThunkConfigWithSignal>(
  "evaluationExtractionRuns/streamRunStatus",
  async (_, { extra: { services }, getState, dispatch, signal }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }

    await services.evaluationExtractionRuns.streamRunStatus({
      ...params,
      signal,
      onStatusChanged: (event) => {
        dispatch(
          evaluationExtractionRunsActions.patchRunStatus({
            evaluationExtractionRunId: event.evaluationExtractionRunId,
            status: event.status,
            summary: event.summary,
            updatedAt: event.updatedAt,
          }),
        )
      },
    })
  },
)

export const evaluationExtractionRunsThunks = {
  cancelOne,
  createAndExecute,
  deleteOne,
  retryOne,
  getAll,
  getOne,
  getRecords,
  streamRunStatus,
}
