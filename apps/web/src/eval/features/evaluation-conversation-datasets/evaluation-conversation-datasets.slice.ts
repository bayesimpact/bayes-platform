import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type {
  EvaluationConversationDataset,
  PaginatedEvaluationConversationDatasetRecords,
} from "./evaluation-conversation-datasets.models"
import { evaluationConversationDatasetsThunks } from "./evaluation-conversation-datasets.thunks"

interface State {
  data: AsyncData<EvaluationConversationDataset[]>
  records: AsyncData<PaginatedEvaluationConversationDatasetRecords>
}

const initialState: State = {
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

    builder
      .addCase(evaluationConversationDatasetsThunks.listRecords.pending, (state) => {
        if (!ADS.isFulfilled(state.records)) state.records.status = ADS.Loading
        state.records.error = null
      })
      .addCase(evaluationConversationDatasetsThunks.listRecords.fulfilled, (state, action) => {
        state.records = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(evaluationConversationDatasetsThunks.listRecords.rejected, (state, action) => {
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
