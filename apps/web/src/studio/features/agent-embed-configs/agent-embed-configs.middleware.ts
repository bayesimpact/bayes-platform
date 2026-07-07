import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { agentEmbedConfigsActions } from "./agent-embed-configs.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: agentEmbedConfigsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(agentEmbedConfigsActions.fetchConfig())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentEmbedConfigsActions.unmount,
    effect: (_, listenerApi) => {
      listenerApi.dispatch(agentEmbedConfigsActions.reset())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentEmbedConfigsActions.updateConfig.fulfilled,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(agentEmbedConfigsActions.fetchConfig())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentEmbedConfigsActions.updateConfig.fulfilled,
    effect: (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Embed config updated successfully",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentEmbedConfigsActions.updateConfig.rejected,
    effect: (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to update embed config",
          type: "error",
        }),
      )
    },
  })
}

export const agentEmbedConfigsMiddleware = { listenerMiddleware, registerListeners }
