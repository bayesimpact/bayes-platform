import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { listAgentSettingsWithDraft } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { projectsActions } from "@/common/features/projects/projects.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createMcpServer,
  deleteMcpServer,
  disableMcpServerForAgent,
  enableMcpServerForAgent,
  initiateMcpServerOauth,
  listMcpServers,
} from "./mcp-servers.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: projectsActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listMcpServers())
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(createMcpServer.fulfilled, deleteMcpServer.fulfilled),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listMcpServers())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createMcpServer.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "mcpServers:notifications.created",
          type: "success",
        }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createMcpServer.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "mcpServers:notifications.createError",
          description: action.payload || undefined,
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteMcpServer.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "mcpServers:notifications.deleted",
          type: "success",
        }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteMcpServer.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "mcpServers:notifications.deleteError",
          type: "error",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: enableMcpServerForAgent.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(listAgentSettingsWithDraft({ agentId: action.meta.arg.agentId }))
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "mcpServers:notifications.enabled",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: disableMcpServerForAgent.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(listAgentSettingsWithDraft({ agentId: action.meta.arg.agentId }))
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "mcpServers:notifications.disabled",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: enableMcpServerForAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "mcpServers:notifications.enableError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: disableMcpServerForAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "mcpServers:notifications.disableError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: initiateMcpServerOauth.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "mcpServers:notifications.authorizationError",
          description: action.payload || undefined,
          type: "error",
        }),
      )
    },
  })
}

export const mcpServersMiddleware = { listenerMiddleware, registerListeners }
