import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getCurrentId } from "../helpers"
import type { Agent, AgentModelsCatalog } from "./agents.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAgents = createAsyncThunk<Agent[], { includeDrafts: boolean }, ThunkConfig>(
  "agents/list",
  async ({ includeDrafts }, { extra: { services }, getState, requestId }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    const agents = includeDrafts
      ? await services.agents.getAllWithDrafts(params)
      : await services.agents.getAll(params)
    // Two creations in a row reload the list twice, and the first answer can arrive last
    // without the second agent. Only the latest request may reach the reducers and listeners.
    const latestRequestId = getState().agents?.latestListRequestId
    if (latestRequestId && latestRequestId !== requestId) {
      throw new Error("A newer list of agents was requested")
    }
    return agents
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
