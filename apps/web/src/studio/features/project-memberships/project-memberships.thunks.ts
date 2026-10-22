import type { EditableProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type {
  ProjectMemberAgent,
  ProjectMembership,
  ProjectRole,
} from "./project-memberships.models"

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

export const updateProjectMembershipRole = createAsyncThunk<
  ProjectMembership,
  { memberUserId: string; role: EditableProjectMembershipRoleDto },
  ThunkConfig
>(
  "projectMemberships/updateRole",
  async ({ memberUserId, role }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.projectMemberships.updateOne({
      organizationId,
      projectId,
      memberUserId,
      role,
    })
  },
)

export const removeProjectMembership = createAsyncThunk<
  void,
  { memberUserId: string },
  ThunkConfig
>("projectMemberships/remove", async ({ memberUserId }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.projectMemberships.remove({ organizationId, projectId, memberUserId })
})

export const listProjectMemberAgents = createAsyncThunk<
  ProjectMemberAgent[],
  { memberUserId: string },
  ThunkConfig
>(
  "projectMemberships/listMemberAgents",
  async ({ memberUserId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.projectMemberships.getMemberAgents({
      organizationId,
      projectId,
      memberUserId,
    })
  },
)

export const listAssignableProjectRoles = createAsyncThunk<ProjectRole[], void, ThunkConfig>(
  "projectMemberships/listAssignableRoles",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.projectMemberships.getAssignableRoles({ organizationId, projectId })
  },
)

/** All or nothing: the API refuses the whole call when it refuses one member. */
export const addProjectMemberRoles = createAsyncThunk<
  ProjectMembership[],
  { memberUserIds: string[]; roleKeys: string[] },
  ThunkConfig
>(
  "projectMemberships/addRoles",
  async ({ memberUserIds, roleKeys }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    return await services.projectMemberships.addRoles({
      organizationId,
      projectId,
      memberUserIds,
      roleKeys,
    })
  },
)

/** All or nothing: the API refuses the whole call when it refuses one member. */
export const removeProjectMembers = createAsyncThunk<
  void,
  { memberUserIds: string[] },
  ThunkConfig
>("projectMemberships/removeMany", async ({ memberUserIds }, { extra: { services }, getState }) => {
  const state = getState()
  const organizationId = getCurrentId({ state, name: "organizationId" })
  const projectId = getCurrentId({ state, name: "projectId" })
  return await services.projectMemberships.removeMany({ organizationId, projectId, memberUserIds })
})
