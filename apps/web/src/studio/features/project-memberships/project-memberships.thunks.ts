import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type {
  AssignableRoles,
  MemberResourceKind,
  MemberRoles,
  ProjectMembership,
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

export const listAssignableRoles = createAsyncThunk<AssignableRoles, void, ThunkConfig>(
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

/** The current member's roles on the workspace, its agents and its review campaigns. */
export const loadMemberRoles = createAsyncThunk<MemberRoles, void, ThunkConfig>(
  "projectMemberships/loadMemberRoles",
  async (_, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const memberUserId = getCurrentId({ state, name: "memberUserId" })
    return await services.projectMemberships.getMemberRoles({
      organizationId,
      projectId,
      memberUserId,
    })
  },
)

type ResourceRoleChange = { kind: MemberResourceKind; resourceId: string; roleKey: string }

/** Gives the current member a role on a resource of the workspace. */
export const addMemberResourceRole = createAsyncThunk<void, ResourceRoleChange, ThunkConfig>(
  "projectMemberships/addMemberResourceRole",
  async ({ kind, resourceId, roleKey }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const memberUserId = getCurrentId({ state, name: "memberUserId" })
    const scope = { organizationId, projectId, memberUserId }
    switch (kind) {
      case "project":
        await services.projectMemberships.addRoles({
          organizationId,
          projectId,
          memberUserIds: [memberUserId],
          roleKeys: [roleKey],
        })
        return
      case "agent":
        return services.projectMemberships.addAgentRole({ ...scope, agentId: resourceId, roleKey })
      case "review_campaign":
        return services.projectMemberships.addCampaignRole({
          ...scope,
          reviewCampaignId: resourceId,
          roleKey,
        })
    }
  },
)

/** Takes a role from the current member on a resource. A campaign role goes by its row. */
export const removeMemberResourceRole = createAsyncThunk<
  void,
  ResourceRoleChange & { membershipId: string },
  ThunkConfig
>(
  "projectMemberships/removeMemberResourceRole",
  async ({ kind, resourceId, roleKey, membershipId }, { extra: { services }, getState }) => {
    const state = getState()
    const organizationId = getCurrentId({ state, name: "organizationId" })
    const projectId = getCurrentId({ state, name: "projectId" })
    const memberUserId = getCurrentId({ state, name: "memberUserId" })
    const scope = { organizationId, projectId, memberUserId }
    switch (kind) {
      case "project":
        return services.projectMemberships.removeRole({ ...scope, roleKey })
      case "agent":
        return services.projectMemberships.removeAgentRole({
          ...scope,
          agentId: resourceId,
          roleKey,
        })
      case "review_campaign":
        return services.projectMemberships.revokeCampaignRole({
          organizationId,
          projectId,
          reviewCampaignId: resourceId,
          membershipId,
        })
    }
  },
)
