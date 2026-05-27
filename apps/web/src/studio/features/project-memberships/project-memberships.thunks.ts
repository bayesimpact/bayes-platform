import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { ProjectMemberAgent, ProjectMembership } from "./project-memberships.models"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const listProjectMemberships = createAsyncThunk<ProjectMembership[], void, ThunkConfig>(
  "projectMemberships/list",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.projectMemberships.getAll({ organizationId, projectId })
  },
)

export const removeProjectMembership = createAsyncThunk<
  void,
  { membershipId: string },
  ThunkConfig
>("projectMemberships/remove", async ({ membershipId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.projectMemberships.remove({ organizationId, projectId, membershipId })
})

export const listProjectMemberAgents = createAsyncThunk<
  ProjectMemberAgent[],
  { membershipId: string },
  ThunkConfig
>(
  "projectMemberships/listMemberAgents",
  async ({ membershipId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.projectMemberships.getMemberAgents({
      organizationId,
      projectId,
      membershipId,
    })
  },
)
