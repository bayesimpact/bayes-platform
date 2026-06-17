import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { selectIsTermsManagementAuthorized } from "@/common/features/me/me.selectors"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { backofficeActions } from "./backoffice.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: backofficeActions.mount,
    effect: async (_, listenerApi) => {
      if (selectIsTermsManagementAuthorized(listenerApi.getState()))
        listenerApi.dispatch(backofficeActions.listTermsDocuments())
    },
  })
  listenerMiddleware.startListening({
    actionCreator: backofficeActions.unmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(backofficeActions.reset())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.organizationsPanelMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(backofficeActions.listOrganizations({ page: 0, limit: 10 }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.agentsPanelMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(backofficeActions.listAgents({ page: 0, limit: 10 }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.projectsPanelMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(backofficeActions.listProjects({ page: 0, limit: 10 }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.usersPanelMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(backofficeActions.listUsers({ page: 0, limit: 10 }))
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      backofficeActions.addFeatureFlag.fulfilled,
      backofficeActions.removeFeatureFlag.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Backoffice project updated",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      backofficeActions.addFeatureFlag.rejected,
      backofficeActions.removeFeatureFlag.rejected,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Backoffice project update failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.updateTermsDocuments.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Terms documents saved",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.updateTermsDocuments.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to save terms documents",
          description: action.error.message,
          type: "error",
        }),
      )
    },
  })
}

export const backofficeMiddleware = { listenerMiddleware, registerListeners }
