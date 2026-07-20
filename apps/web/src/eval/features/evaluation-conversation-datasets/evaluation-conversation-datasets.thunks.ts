import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { ThunkConfig } from "@/common/store/types"
import type {
  EvaluationConversationDataset,
  PaginatedEvaluationConversationDatasetRecords,
} from "./evaluation-conversation-datasets.models"

const listDatasets = createAsyncThunk<EvaluationConversationDataset[], void, ThunkConfig>(
  "conversationDatasets/listDatasets",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationConversationDatasets.getAll(params)
  },
)

const listRecords = createAsyncThunk<
  PaginatedEvaluationConversationDatasetRecords,
  {
    datasetId: string
    page?: number
    limit?: number
  },
  ThunkConfig
>("conversationDatasets/listRecords", async (args, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }
  return await services.evaluationConversationDatasets.getRecords({
    ...params,
    ...args,
  })
})

const createOne = createAsyncThunk<{ success: true }, { name: string }, ThunkConfig>(
  "conversationDatasets/createOne",
  async (payload, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return await services.evaluationConversationDatasets.createOne({
      ...params,
      payload,
    })
  },
)

const renameOne = createAsyncThunk<
  { success: true },
  { datasetId: string; name: string },
  ThunkConfig
>(
  "conversationDatasets/renameOne",
  async ({ datasetId, name }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId, datasetId }
    return await services.evaluationConversationDatasets.renameOne({
      ...params,
      payload: { name },
    })
  },
)

const deleteOne = createAsyncThunk<void, { datasetId: string }, ThunkConfig>(
  "conversationDatasets/deleteOne",
  async ({ datasetId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.evaluationConversationDatasets.deleteOne({
      organizationId,
      projectId,
      datasetId,
    })
  },
)

const createRecord = createAsyncThunk<
  { success: true },
  { datasetId: string; input: string; expectedOutput: string },
  ThunkConfig
>(
  "conversationDatasets/createRecord",
  async ({ datasetId, input, expectedOutput }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId, datasetId }
    return await services.evaluationConversationDatasets.createRecord({
      ...params,
      payload: { input, expectedOutput },
    })
  },
)

const updateRecord = createAsyncThunk<
  { success: true },
  { datasetId: string; recordId: string; input: string; expectedOutput: string },
  ThunkConfig
>(
  "conversationDatasets/updateRecord",
  async ({ datasetId, recordId, input, expectedOutput }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId, datasetId, recordId }
    return await services.evaluationConversationDatasets.updateRecord({
      ...params,
      payload: { input, expectedOutput },
    })
  },
)

const deleteRecord = createAsyncThunk<void, { datasetId: string; recordId: string }, ThunkConfig>(
  "conversationDatasets/deleteRecord",
  async ({ datasetId, recordId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.evaluationConversationDatasets.deleteRecord({
      organizationId,
      projectId,
      datasetId,
      recordId,
    })
  },
)

export const evaluationConversationDatasetsThunks = {
  listDatasets,
  listRecords,
  createOne,
  renameOne,
  deleteOne,
  createRecord,
  updateRecord,
  deleteRecord,
}
