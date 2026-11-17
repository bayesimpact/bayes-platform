import { createListenerMiddleware } from "@reduxjs/toolkit"
import {
  createAgentSettings,
  listAgentSettingsWithDraft,
  restoreAgentSettings,
  setProductionAgentSettings,
  updateAgentSettings,
} from "@/common/features/agents/agent-settings/agent-settings.thunks"
import type { AppDispatch, RootState } from "@/common/store/types"
import { getCurrentId } from "../../helpers"
import { notificationsActions } from "../../notifications/notifications.slice"
import { listAgents } from "../agents.thunks"
import { agentSettingsActions } from "./agent-settings.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

const refresh = ({
  listenerApi,
}: {
  listenerApi: { dispatch: AppDispatch; getState: () => RootState }
}) => {
  const state = listenerApi.getState()
  const agentId = getCurrentId({ state, name: "agentId" })
  listenerApi.dispatch(listAgents({ includeDrafts: true }))
  listenerApi.dispatch(listAgentSettingsWithDraft({ agentId }))
}

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: listAgents.fulfilled,
    effect: async (action, listenerApi) => {
      const state = listenerApi.getState()
      const agentIds = action.payload.map((agent) => agent.id)

      // Check if agent settings are already in the state, if not, dispatch listAgentSettingsWithDraft for that agent
      for (const agentId of agentIds) {
        const agentSettings = state.agentSettings.history[agentId]
        if (!agentSettings) {
          listenerApi.dispatch(listAgentSettingsWithDraft({ agentId }))
        }
      }
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentSettingsActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      listenerApi.dispatch(listAgentSettingsWithDraft({ agentId }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: restoreAgentSettings.fulfilled,
    effect: async (_, listenerApi) => {
      // The thunk already reloaded the agent's settings.
      listenerApi.dispatch(listAgents({ includeDrafts: true }))

      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agentSettings:notifications.versionRestored",
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
          titleKey: "agentSettings:notifications.versionRestoreError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: setProductionAgentSettings.fulfilled,
    effect: async (action, listenerApi) => {
      refresh({ listenerApi })

      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agentSettings:notifications.productionSet",
          titleValues: { revision: action.meta.arg.revision },
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: setProductionAgentSettings.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agentSettings:notifications.productionSetError",
          description: action.payload || undefined,
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createAgentSettings.fulfilled,
    effect: async (action, listenerApi) => {
      refresh({ listenerApi })

      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agentSettings:notifications.versionPublished",
          type: "success",
        }),
      )

      action.meta.arg.onSuccess?.()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createAgentSettings.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agentSettings:notifications.versionPublishError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: updateAgentSettings.fulfilled,
    // No success notification: the editor saves by itself and shows the state of the save.
    effect: async (_, listenerApi) => {
      refresh({ listenerApi })
    },
  })
  // No error notification either: the editor shows the failed save, with its reason.
}
export const agentSettingsMiddleware = { listenerMiddleware, registerListeners }
