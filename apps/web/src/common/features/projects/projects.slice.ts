import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Project } from "./projects.models"
import { listProjects } from "./projects.thunks"

interface State {
  data: AsyncData<Project[]>
}

const initialState: State = {
  data: defaultAsyncData,
}

const slice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(listProjects.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listProjects.fulfilled, (state, action) => {
        state.data = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(listProjects.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to list projects"
      })
  },
})

export type { State as ProjectsState }
export const projectsInitialState = initialState
export const projectsActions = { ...slice.actions }
export const projectsSlice = slice
