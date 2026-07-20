import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { ThunkConfig } from "@/common/store/types"
import type {
  EvaluationConversationRun,
  PaginatedEvaluationConversationRunRecords,
} from "./evaluation-conversation-runs.models"
import { evaluationConversationRunsActions } from "./evaluation-conversation-runs.slice"

type ThunkConfigWithSignal = ThunkConfig & { serializedErrorType: Error }

const getAll = createAsyncThunk<EvaluationConversationRun[], void, ThunkConfig>(
  "conversationRuns/getAll",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationConversationRuns.getAll(params)
  },
)

const getOne = createAsyncThunk<
  EvaluationConversationRun,
  { evaluationConversationRunId: string },
  ThunkConfig
>(
  "conversationRuns/getOne",
  async ({ evaluationConversationRunId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationConversationRuns.getOne({
      ...params,
      evaluationConversationRunId,
    })
  },
)

const getRecords = createAsyncThunk<
  PaginatedEvaluationConversationRunRecords,
  {
    evaluationConversationRunId: string
    page?: number
    limit?: number
  },
  ThunkConfig
>(
  "conversationRuns/getRecords",
  async ({ evaluationConversationRunId, page, limit }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.evaluationConversationRuns.getRecords({
      organizationId,
      projectId,
      evaluationConversationRunId,
      page,
      limit,
    })
  },
)

const createAndExecute = createAsyncThunk<
  EvaluationConversationRun,
  {
    datasetId: string
    agentId: string
    recordLimit: number | null
  },
  ThunkConfig
>("conversationRuns/createAndExecute", async (payload, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }

  const run = await services.evaluationConversationRuns.createOne({
    ...params,
    payload: {
      agentId: payload.agentId,
      datasetId: payload.datasetId,
    },
  })
  await services.evaluationConversationRuns.executeOne({
    ...params,
    evaluationConversationRunId: run.id,
    recordLimit: payload.recordLimit,
  })
  return run
})

const retryOne = createAsyncThunk<
  EvaluationConversationRun,
  {
    evaluationConversationRunId: string
  },
  ThunkConfig
>(
  "conversationRuns/retryOne",
  async ({ evaluationConversationRunId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationConversationRuns.retryOne({
      ...params,
      evaluationConversationRunId,
    })
  },
)

const cancelOne = createAsyncThunk<
  EvaluationConversationRun,
  { evaluationConversationRunId: string },
  ThunkConfig
>(
  "conversationRuns/cancelOne",
  async ({ evaluationConversationRunId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationConversationRuns.cancelOne({
      ...params,
      evaluationConversationRunId,
    })
  },
)

const deleteOne = createAsyncThunk<void, { evaluationConversationRunId: string }, ThunkConfig>(
  "conversationRuns/deleteOne",
  async ({ evaluationConversationRunId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.evaluationConversationRuns.deleteOne({
      organizationId,
      projectId,
      evaluationConversationRunId,
    })
  },
)

const streamRunStatus = createAsyncThunk<void, void, ThunkConfigWithSignal>(
  "conversationRuns/streamRunStatus",
  async (_, { extra: { services }, getState, dispatch, signal }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }

    await services.evaluationConversationRuns.streamRunStatus({
      ...params,
      signal,
      onStatusChanged: (event) => {
        dispatch(
          evaluationConversationRunsActions.patchRunStatus({
            evaluationConversationRunId: event.evaluationConversationRunId,
            status: event.status,
            summary: event.summary,
            updatedAt: event.updatedAt,
          }),
        )
      },
    })
  },
)

export const evaluationConversationRunsThunks = {
  cancelOne,
  createAndExecute,
  deleteOne,
  retryOne,
  getAll,
  getOne,
  getRecords,
  streamRunStatus,
}
