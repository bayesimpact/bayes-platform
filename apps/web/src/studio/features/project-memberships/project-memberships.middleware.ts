import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createInvitations,
  listInvitationsForTarget,
  revokeInvitation,
} from "@/studio/features/invitations/invitations.thunks"
import { projectMembershipsActions } from "./project-memberships.slice"
import {
  addMemberResourceRole,
  addProjectMemberRoles,
  listAssignableProjectRoles,
  listProjectMemberships,
  loadMemberRoles,
  removeMemberResourceRole,
  removeProjectMembers,
} from "./project-memberships.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: projectMembershipsActions.mount,
    effect: async (_, listenerApi) => {
      const projectId = selectCurrentProjectId(listenerApi.getState())
      if (!projectId) return
      await Promise.all([
        listenerApi.dispatch(listProjectMemberships()),
        listenerApi.dispatch(listAssignableProjectRoles()),
        listenerApi.dispatch(
          listInvitationsForTarget({ targetType: "project", targetId: projectId }),
        ),
      ])
    },
  })

  listenerMiddleware.startListening({
    actionCreator: projectMembershipsActions.memberMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(loadMemberRoles())
    },
  })

  // A role change on the member page: reload their roles, and the list their row belongs to
  listenerMiddleware.startListening({
    matcher: isAnyOf(addMemberResourceRole.fulfilled, removeMemberResourceRole.fulfilled),
    effect: async (_, listenerApi) => {
      await Promise.all([
        listenerApi.dispatch(loadMemberRoles()),
        listenerApi.dispatch(listProjectMemberships()),
      ])
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createInvitations.fulfilled,
    effect: async (action, listenerApi) => {
      const { targetType, targetId } = action.meta.arg
      if (targetType !== "project") return
      await listenerApi.dispatch(listInvitationsForTarget({ targetType, targetId }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: revokeInvitation.fulfilled,
    effect: async (action, listenerApi) => {
      const { targetType, targetId } = action.meta.arg
      if (targetType !== "project") return
      await listenerApi.dispatch(listInvitationsForTarget({ targetType, targetId }))
    },
  })

  // Removing members can end pending invitations and accounts that never signed in
  listenerMiddleware.startListening({
    actionCreator: removeProjectMembers.fulfilled,
    effect: async (_, listenerApi) => {
      const projectId = selectCurrentProjectId(listenerApi.getState())
      if (!projectId) return
      await Promise.all([
        listenerApi.dispatch(listProjectMemberships()),
        listenerApi.dispatch(
          listInvitationsForTarget({ targetType: "project", targetId: projectId }),
        ),
      ])
    },
  })

  listenerMiddleware.startListening({
    actionCreator: addProjectMemberRoles.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "projectMembership:notifications.rolesAdded",
          titleValues: { count: action.meta.arg.memberUserIds.length },
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: removeProjectMembers.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "projectMembership:notifications.membersRemoved",
          titleValues: { count: action.meta.arg.memberUserIds.length },
          type: "success",
        }),
      )
    },
  })

  // Success notifications
  listenerMiddleware.startListening({
    actionCreator: createInvitations.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "project") return
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: action.payload.emailSent
            ? "projectMembership:notifications.invitationsSentByEmail"
            : "projectMembership:notifications.peopleInvited",
          type: "success",
        }),
      )
    },
  })

  // Error notifications
  listenerMiddleware.startListening({
    actionCreator: createInvitations.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.targetType !== "project") return
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "projectMembership:notifications.inviteError",
          type: "error",
        }),
      )
    },
  })
}

export const projectMembershipsMiddleware = { listenerMiddleware, registerListeners }
