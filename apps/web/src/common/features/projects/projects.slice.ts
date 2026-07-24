import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { MyProject, Project } from "./projects.models"
import { fetchMyProjects, listProjects } from "./projects.thunks"

interface State {
  /** Projects of the current organization (studio context). */
  data: AsyncData<Project[]>
  /** All projects the current user can access, across organizations. */
  mine: AsyncData<MyProject[]>
}

const initialState: State = {
  data: defaultAsyncData,
  mine: defaultAsyncData,
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

    builder
      .addCase(fetchMyProjects.pending, (state) => {
        if (!ADS.isFulfilled(state.mine)) state.mine.status = ADS.Loading
        state.mine.error = null
      })
      .addCase(fetchMyProjects.fulfilled, (state, action) => {
        state.mine = {
          status: ADS.Fulfilled,
          error: null,
          value: action.payload,
        }
      })
      .addCase(fetchMyProjects.rejected, (state, action) => {
        state.mine.status = ADS.Error
        state.mine.error = action.error.message || "Failed to list my projects"
      })
  },
})

export type { State as ProjectsState }
export const projectsInitialState = initialState
export const projectsActions = { ...slice.actions }
export const projectsSlice = slice
