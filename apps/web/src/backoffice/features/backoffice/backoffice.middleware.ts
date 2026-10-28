import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import {
  selectIsAppManagementAuthorized,
  selectIsTermsManagementAuthorized,
} from "@/common/features/me/me.selectors"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { backofficeActions } from "./backoffice.slice"

const MAINTENANCE_JOBS_REFRESH_INTERVAL_MS = 3000

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
    actionCreator: backofficeActions.maintenanceJobsPanelMount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(backofficeActions.listMaintenanceJobs())
    },
  })

  // While a run is waiting or active, the panel reloads every few seconds to follow its progress.
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      backofficeActions.listMaintenanceJobs.fulfilled,
      backofficeActions.runMaintenanceJob.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.cancelActiveListeners()
      const maintenanceJobs = listenerApi.getState().backoffice.maintenanceJobs.value ?? []
      const isRunning = maintenanceJobs.some(
        (job) => job.lastRun?.state === "waiting" || job.lastRun?.state === "active",
      )
      if (!isRunning) return
      const panelClosed = await listenerApi.condition(
        backofficeActions.maintenanceJobsPanelUnmount.match,
        MAINTENANCE_JOBS_REFRESH_INTERVAL_MS,
      )
      if (!panelClosed) listenerApi.dispatch(backofficeActions.listMaintenanceJobs())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.runMaintenanceJob.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "backoffice:notifications.maintenanceJobStarted",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.runMaintenanceJob.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "backoffice:notifications.maintenanceJobStartError",
          description: action.error.message,
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.createOrganization.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "backoffice:notifications.organizationCreated",
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
          titleKey: "backoffice:notifications.organizationCreateError",
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
          titleKey: "backoffice:notifications.projectUpdated",
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
          titleKey: "backoffice:notifications.projectUpdateError",
          type: "error",
        }),
      )
    },
  })

  // The agent page reloads so its reviewer list shows what the server now holds.
  for (const reviewerThunk of [
    backofficeActions.grantAgentConversationReviewer,
    backofficeActions.revokeAgentConversationReviewer,
  ]) {
    listenerMiddleware.startListening({
      actionCreator: reviewerThunk.fulfilled,
      effect: async (action, listenerApi) => {
        listenerApi.dispatch(
          notificationsActions.show({
            titleKey: "backoffice:notifications.conversationReviewersUpdated",
            type: "success",
          }),
        )
        listenerApi.dispatch(backofficeActions.getAgent(action.payload.agentId))
      },
    })
    listenerMiddleware.startListening({
      actionCreator: reviewerThunk.rejected,
      effect: async (action, listenerApi) => {
        listenerApi.dispatch(
          notificationsActions.show({
            titleKey: "backoffice:notifications.conversationReviewersUpdateError",
            description: action.error.message,
            type: "error",
          }),
        )
      },
    })
  }

  // The user page reloads so its global roles show what the server now holds.
  for (const globalRoleThunk of [
    backofficeActions.grantUserGlobalRole,
    backofficeActions.revokeUserGlobalRole,
  ]) {
    listenerMiddleware.startListening({
      actionCreator: globalRoleThunk.fulfilled,
      effect: async (action, listenerApi) => {
        listenerApi.dispatch(
          notificationsActions.show({
            titleKey: "backoffice:notifications.globalRolesUpdated",
            type: "success",
          }),
        )
        listenerApi.dispatch(backofficeActions.getUser(action.payload.userId))
      },
    })
    listenerMiddleware.startListening({
      actionCreator: globalRoleThunk.rejected,
      effect: async (action, listenerApi) => {
        listenerApi.dispatch(
          notificationsActions.show({
            titleKey: "backoffice:notifications.globalRolesUpdateError",
            description: action.error.message,
            type: "error",
          }),
        )
      },
    })
  }

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.updateTermsDocuments.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "backoffice:notifications.termsDocumentsSaved",
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
          titleKey: "backoffice:notifications.termsDocumentsSaveError",
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
      const titleKey = backofficeActions.createAppManifest.fulfilled.match(action)
        ? "backoffice:notifications.appCreated"
        : backofficeActions.updateAppManifest.fulfilled.match(action)
          ? "backoffice:notifications.appUpdated"
          : "backoffice:notifications.appDeleted"
      listenerApi.dispatch(notificationsActions.show({ titleKey, type: "success" }))
      listenerApi.dispatch(backofficeActions.listAppManifests())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.createAppManifest.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "backoffice:notifications.appCreateError",
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
          titleKey: "backoffice:notifications.appUpdateError",
          description: action.error.message,
          type: "error",
        }),
      )
    },
  })

  for (const rejected of [
    backofficeActions.getAppOAuthClient.rejected,
    backofficeActions.createAppOAuthClientSecret.rejected,
  ]) {
    listenerMiddleware.startListening({
      actionCreator: rejected,
      effect: async (action, listenerApi) => {
        listenerApi.dispatch(
          notificationsActions.show({
            titleKey: "backoffice:notifications.appOAuthClientError",
            description: action.error.message,
            type: "error",
          }),
        )
      },
    })
  }

  listenerMiddleware.startListening({
    actionCreator: backofficeActions.deleteAppManifest.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "backoffice:notifications.appDeleteError",
          description: action.error.message,
          type: "error",
        }),
      )
    },
  })
}

export const backofficeMiddleware = { listenerMiddleware, registerListeners }
