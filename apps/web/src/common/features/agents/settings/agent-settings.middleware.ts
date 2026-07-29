import { createListenerMiddleware } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { agentSettingsActions } from "./agent-settings.slice"
import {
  listAgentSettings,
  publishAgentSettings,
  restoreAgentSettings,
  updateAgentSettings,
} from "./agent-settings.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

// Refetch after every mutation, including a rejected one: a tab may save through two
// endpoints in sequence, so a failed second call can leave the first already applied,
// and only a refetch shows the true state.
const mutationsToRefetchOn = [
  updateAgentSettings.fulfilled,
  updateAgentSettings.rejected,
  publishAgentSettings.fulfilled,
  restoreAgentSettings.fulfilled,
] as const

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: agentSettingsActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      listenerApi.dispatch(listAgentSettings({ agentId }))
    },
  })

  for (const mutationAction of mutationsToRefetchOn) {
    listenerMiddleware.startListening({
      actionCreator: mutationAction,
      effect: async (action, listenerApi) => {
        listenerApi.dispatch(listAgentSettings({ agentId: action.meta.arg.agentId }))
      },
    })
  }

  listenerMiddleware.startListening({
    actionCreator: restoreAgentSettings.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent version restored successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: restoreAgentSettings.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent version restore failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: publishAgentSettings.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent version published successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: publishAgentSettings.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent version publish failed",
          type: "error",
        }),
      )
    },
  })
}

export const agentSettingsMiddleware = { listenerMiddleware, registerListeners }
