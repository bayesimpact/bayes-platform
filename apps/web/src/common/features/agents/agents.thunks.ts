import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import { getAppPathname } from "@/config/runtime-config"
import { DeskRoutes } from "@/desk/routes/helpers"
import { getCurrentId } from "../helpers"
import type { Agent } from "./agents.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAgents = createAsyncThunk<Agent[], void, ThunkConfig>(
  "agents/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const params = { organizationId, projectId }
    // FIXME: This is a temporary solution to avoid fetching drafts in the Desk app. We should refactor this logic to be more robust and not rely on the URL path.
    const isDesk = getAppPathname().startsWith(DeskRoutes.home.path)
    return isDesk
      ? await services.agents.getAll(params)
      : await services.agents.getAllWithDrafts(params)
  },
)
