import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getCurrentId } from "../../../common/features/helpers"
import type {
  Project,
  ProjectSessionCategory,
} from "../../../common/features/projects/projects.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const createProject = createAsyncThunk<
  Project,
  {
    organizationId: string
    payload: Pick<Project, "name">
    onSuccess?: (projectId: string) => void
  },
  ThunkConfig
>("projects/create", async ({ organizationId, payload }, { extra: { services } }) => {
  return await services.projects.createOne({ organizationId }, payload)
})

export const updateProject = createAsyncThunk<
  void,
  { payload: Pick<Project, "name"> },
  ThunkConfig
>("projects/update", async ({ payload }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  const params = { organizationId, projectId }
  await services.projects.updateOne(params, payload)
})

export const deleteProject = createAsyncThunk<void, { onSuccess?: () => void }, ThunkConfig>(
  "projects/delete",
  async ({ onSuccess }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    await services.projects.deleteOne(params)
    if (onSuccess) onSuccess()
  },
)

export const addProjectSessionCategory = createAsyncThunk<
  ProjectSessionCategory,
  { name: string; assignToAllConversationalAgents: boolean },
  ThunkConfig
>(
  "projects/addProjectSessionCategory",
  async ({ name, assignToAllConversationalAgents }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.projects.addProjectSessionCategory(
      { organizationId, projectId },
      { name, assignToAllConversationalAgents },
    )
  },
)

export const deleteProjectSessionCategory = createAsyncThunk<
  void,
  { categoryId: string },
  ThunkConfig
>(
  "projects/deleteProjectSessionCategory",
  async ({ categoryId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    await services.projects.deleteProjectSessionCategory({ organizationId, projectId, categoryId })
  },
)
