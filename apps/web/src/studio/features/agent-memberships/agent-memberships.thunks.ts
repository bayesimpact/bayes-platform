import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { AgentMembership } from "./agent-memberships.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const list = createAsyncThunk<AgentMembership[], void, ThunkConfig>(
  "agentMemberships/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    return await services.agentMemberships.getAll({ organizationId, projectId, agentId })
  },
)

const remove = createAsyncThunk<void, { membershipId: string }, ThunkConfig>(
  "agentMemberships/remove",
  async ({ membershipId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const agentId = getCurrentId({ state, name: "agentId" })
    return await services.agentMemberships.remove({
      organizationId,
      projectId,
      agentId,
      membershipId,
    })
  },
)

export const agentMembershipsThunks = { list, remove }
