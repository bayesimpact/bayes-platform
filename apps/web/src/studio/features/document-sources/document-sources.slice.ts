import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { DocumentSource } from "./document-sources.models"
import { deleteDocumentSource, listDocumentSources } from "./document-sources.thunks"

interface State {
  data: AsyncData<DocumentSource[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "documentSources",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listDocumentSources.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listDocumentSources.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listDocumentSources.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list document sources"
      })
      .addCase(deleteDocumentSource.fulfilled, (state, action) => {
        if (!ADS.isFulfilled(state.data)) return
        state.data.value = state.data.value.filter(
          (documentSource) => documentSource.id !== action.payload,
        )
      })
  },
})

export type { State as documentSourcesState }
export const documentSourcesActions = { ...slice.actions }
export const documentSourcesSlice = slice
