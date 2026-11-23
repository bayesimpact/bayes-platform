import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { EvaluationConversationDataset } from "./evaluation-conversation-datasets.models"
import { evaluationConversationDatasetsThunks } from "./evaluation-conversation-datasets.thunks"

interface State {
  data: AsyncData<EvaluationConversationDataset[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "conversationDatasets",
  initialState,
  reducers: {
    reset: () => initialState,
    mount: () => {},
    unmount: () => {},
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
  },
})

export const evaluationConversationDatasetsActions = {
  ...slice.actions,
  ...evaluationConversationDatasetsThunks,
}
export const evaluationConversationDatasetsSlice = slice
