import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getCurrentId } from "../helpers"
import type { Agent, AgentModelsCatalog } from "./agents.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAgents = createAsyncThunk<Agent[], { includeDrafts: boolean }, ThunkConfig>(
  "agents/list",
  async ({ includeDrafts }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    return includeDrafts
      ? await services.agents.getAllWithDrafts(params)
      : await services.agents.getAll(params)
  },
)

/** The model catalog of the current project (it depends on the project's feature flags). */
export const listAvailableModels = createAsyncThunk<AgentModelsCatalog, void, ThunkConfig>(
  "agents/listAvailableModels",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.agents.getAvailableModels({ organizationId, projectId })
  },
)
