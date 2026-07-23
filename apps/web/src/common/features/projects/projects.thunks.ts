import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getCurrentId } from "../helpers"
import type { MyProject, Project } from "./projects.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listProjects = createAsyncThunk<Project[], void, ThunkConfig>(
  "projects/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const params = { organizationId }
    return await services.projects.getAll(params)
  },
)

export const fetchMyProjects = createAsyncThunk<MyProject[], void, ThunkConfig>(
  "projects/listMine",
  async (_, { extra: { services } }) => await services.projects.getAllMine(),
)
