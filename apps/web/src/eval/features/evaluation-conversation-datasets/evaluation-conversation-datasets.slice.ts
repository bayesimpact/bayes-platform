import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import { currentIdsActions } from "@/eval/store/currentIds.slice"
import type {
  EvaluationConversationDataset,
  PaginatedEvaluationConversationDatasetRecords,
} from "./evaluation-conversation-datasets.models"
import { evaluationConversationDatasetsThunks } from "./evaluation-conversation-datasets.thunks"

interface State {
  // Mirrors state.currentIds.datasetId; kept locally so reducers can guard stale responses.
  currentDatasetId: string | null
  data: AsyncData<EvaluationConversationDataset[]>
  records: AsyncData<PaginatedEvaluationConversationDatasetRecords>
}

const initialState: State = {
  currentDatasetId: null,
  data: defaultAsyncData,
  records: defaultAsyncData,
}

const slice = createSlice({
  name: "conversationDatasets",
  initialState,
  reducers: {
    reset: () => initialState,
    mount: () => {},
    unmount: () => {},
    // Dataset-route level mount/unmount for the current dataset's records
    // (see ADR 0009): the middleware loads the first page on mountRecords.
    mountRecords: () => {},
    unmountRecords: () => {},
    resetRecords: (state) => {
      state.records = defaultAsyncData
    },
  },
  extraReducers: (builder) => {
    // Sync currentDatasetId from the URL-driven currentIds slice and clear
    // stale per-dataset state on change.
    builder.addCase(currentIdsActions.setDatasetId, (state, action) => {
      if (state.currentDatasetId !== action.payload) {
        state.currentDatasetId = action.payload
        state.records = defaultAsyncData
      }
    })

    builder
      .addCase(evaluationConversationDatasetsThunks.listDatasets.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(evaluationConversationDatasetsThunks.listDatasets.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(evaluationConversationDatasetsThunks.listDatasets.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list datasets"
      })

    // Responses for a dataset other than the current one are stale (the user
    // already switched dataset) and are discarded.
    builder
      .addCase(evaluationConversationDatasetsThunks.listRecords.pending, (state, action) => {
        if (action.meta.arg.datasetId !== state.currentDatasetId) return
        if (!ADS.isFulfilled(state.records)) state.records.status = ADS.Loading
        state.records.error = null
      })
      .addCase(evaluationConversationDatasetsThunks.listRecords.fulfilled, (state, action) => {
        if (action.meta.arg.datasetId !== state.currentDatasetId) return
        state.records = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(evaluationConversationDatasetsThunks.listRecords.rejected, (state, action) => {
        if (action.meta.arg.datasetId !== state.currentDatasetId) return
        state.records.status = ADS.Error
        state.records.error = action.error.message || "Failed to list records"
      })

    builder.addCase(evaluationConversationDatasetsThunks.deleteOne.pending, (state, action) => {
      // Optimistically remove the dataset from the list while the request is in-flight
      // because it can take some time to complete and we want to provide immediate feedback to the user.
      const datasetId = action.meta.arg.datasetId
      state.data.value = state.data.value?.filter((dataset) => dataset.id !== datasetId) || null
    })
  },
})

export type { State as ConversationDatasetsState }
export const conversationDatasetsInitialState = initialState
export const evaluationConversationDatasetsActions = {
  ...slice.actions,
  ...evaluationConversationDatasetsThunks,
}
export const evaluationConversationDatasetsSlice = slice
