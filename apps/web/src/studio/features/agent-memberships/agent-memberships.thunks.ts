import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { ProjectRole } from "@/studio/features/project-memberships/project-memberships.models"
import type { AgentMembership } from "./agent-memberships.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

const currentAgentScope = (state: RootState) => ({
  organizationId: getCurrentId({ state, name: "organizationId" }),
  projectId: getCurrentId({ state, name: "projectId" }),
  agentId: getCurrentId({ state, name: "agentId" }),
})

const list = createAsyncThunk<AgentMembership[], void, ThunkConfig>(
  "agentMemberships/list",
  async (_, { extra: { services }, getState }) =>
    await services.agentMemberships.getAll(currentAgentScope(getState())),
)

/** The roles a member can be given on an agent, in catalog order. */
const listAssignableRoles = createAsyncThunk<ProjectRole[], void, ThunkConfig>(
  "agentMemberships/listAssignableRoles",
  async (_, { extra: { services }, getState }) => {
    const { organizationId, projectId } = currentAgentScope(getState())
    const assignableRoles = await services.projectMemberships.getAssignableRoles({
      organizationId,
      projectId,
    })
    return assignableRoles.agent
  },
)

/** All or nothing: the API refuses the whole call when it refuses one member. */
const addRoles = createAsyncThunk<
  void,
  { memberUserIds: string[]; roleKeys: string[] },
  ThunkConfig
>("agentMemberships/addRoles", async ({ memberUserIds, roleKeys }, { extra, getState }) => {
  await extra.services.agentMemberships.addRoles({
    ...currentAgentScope(getState()),
    memberUserIds,
    roleKeys,
  })
})

/** All or nothing: the API refuses the whole call when it refuses one member. */
const removeMany = createAsyncThunk<void, { memberUserIds: string[] }, ThunkConfig>(
  "agentMemberships/removeMany",
  async ({ memberUserIds }, { extra, getState }) => {
    await extra.services.agentMemberships.removeMany({
      ...currentAgentScope(getState()),
      memberUserIds,
    })
  },
)

export const agentMembershipsThunks = { list, listAssignableRoles, addRoles, removeMany }
