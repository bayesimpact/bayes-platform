import { createAsyncThunk } from "@reduxjs/toolkit"
import type { Agent } from "@/common/features/agents/agents.models"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listAgentHistory = createAsyncThunk<Agent[], void, ThunkConfig>(
  "agentHistory/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    return await services.agents.getHistory({ organizationId, projectId, agentId })
  },
)

export const restoreAgentRevision = createAsyncThunk<void, { revision: number }, ThunkConfig>(
  "agentHistory/restore",
  async ({ revision }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    await services.agents.restoreRevision({ organizationId, projectId, agentId, revision })
  },
)
