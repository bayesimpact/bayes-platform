import type { AgentModel } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import type { Agent } from "@/common/features/agents/agents.models"
import { getCurrentId } from "@/common/features/helpers"
import type { ThunkConfig } from "@/common/store/types"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunRecord,
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

// Loads every record for each selected run so the compare page can align scores
// per dataset record. Runs of the same dataset share small record counts, so a
// single high-limit page per run is enough.
const COMPARISON_RECORD_LIMIT = 1000

const getComparisonRecords = createAsyncThunk<
  Record<string, EvaluationConversationRunRecord[]>,
  { evaluationConversationRunIds: string[] },
  ThunkConfig
>(
  "conversationRuns/getComparisonRecords",
  async ({ evaluationConversationRunIds }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const entries = await Promise.all(
      evaluationConversationRunIds.map(async (evaluationConversationRunId) => {
        const page = await services.evaluationConversationRuns.getRecords({
          organizationId,
          projectId,
          evaluationConversationRunId,
          page: 0,
          limit: COMPARISON_RECORD_LIMIT,
        })
        return [evaluationConversationRunId, page.records] as const
      }),
    )
    return Object.fromEntries(entries)
  },
)

const getAgentHistory = createAsyncThunk<Agent[], { agentId: string }, ThunkConfig>(
  "conversationRuns/getAgentHistory",
  async ({ agentId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.agents.getHistory({ organizationId, projectId, agentId })
  },
)

const createAndExecute = createAsyncThunk<
  EvaluationConversationRun,
  {
    datasetId: string
    agentId: string
    agentSettingsRevision: number
    judgeModel: AgentModel
    judgeInstructions: string | null
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
      agentSettingsRevision: payload.agentSettingsRevision,
      datasetId: payload.datasetId,
      judgeModel: payload.judgeModel,
      judgeInstructions: payload.judgeInstructions,
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
  getAgentHistory,
  getAll,
  getComparisonRecords,
  getOne,
  getRecords,
  streamRunStatus,
}
