import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import {
  selectIsAppManagementAuthorized,
  selectIsTermsManagementAuthorized,
} from "@/common/features/me/me.selectors"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { backofficeActions } from "./backoffice.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: backofficeActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      if (selectIsTermsManagementAuthorized(state))
        listenerApi.dispatch(backofficeActions.listTermsDocuments())
      if (selectIsAppManagementAuthorized(state))
        listenerApi.dispatch(backofficeActions.listAppManifests())
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
    actionCreator: backofficeActions.rbacCatalogMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(backofficeActions.getRbacCatalog())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.appsPanelMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(backofficeActions.listAppManifests())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.createOrganization.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Organization created",
          type: "success",
        }),
      )
      listenerApi.dispatch(backofficeActions.listOrganizations({ page: 0, limit: 10 }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.createOrganization.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to create organization",
          description: action.error.message,
          type: "error",
        }),
      )
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

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      backofficeActions.createAppManifest.fulfilled,
      backofficeActions.updateAppManifest.fulfilled,
      backofficeActions.deleteAppManifest.fulfilled,
    ),
    effect: async (action, listenerApi) => {
      const title = backofficeActions.createAppManifest.fulfilled.match(action)
        ? "App created"
        : backofficeActions.updateAppManifest.fulfilled.match(action)
          ? "App updated"
          : "App deleted"
      listenerApi.dispatch(notificationsActions.show({ title, type: "success" }))
      listenerApi.dispatch(backofficeActions.listAppManifests())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.createAppManifest.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to create app",
          description: action.error.message,
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.updateAppManifest.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to update app",
          description: action.error.message,
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.deleteAppManifest.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to delete app",
          description: action.error.message,
          type: "error",
        }),
      )
    },
  })
}

export const backofficeMiddleware = { listenerMiddleware, registerListeners }
