import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getCurrentId } from "../helpers"
import type { Agent } from "./agents.models"

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
