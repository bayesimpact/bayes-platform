import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { listAgents } from "@/common/features/agents/agents.thunks"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { projectsActions } from "@/common/features/projects/projects.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createMcpServer,
  deleteMcpServer,
  disableMcpServerForAgent,
  enableMcpServerForAgent,
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
        notificationsActions.show({ title: "MCP server created", type: "success" }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createMcpServer.rejected,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "MCP server creation failed",
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
        notificationsActions.show({ title: "MCP server deleted", type: "success" }),
      )
      action.meta.arg.onSuccess()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteMcpServer.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "MCP server deletion failed", type: "error" }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: enableMcpServerForAgent.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listAgents())
      listenerApi.dispatch(
        notificationsActions.show({ title: "MCP server enabled", type: "success" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: disableMcpServerForAgent.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listAgents())
      listenerApi.dispatch(
        notificationsActions.show({ title: "MCP server disabled", type: "success" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: enableMcpServerForAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Failed to enable MCP server", type: "error" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: disableMcpServerForAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Failed to disable MCP server", type: "error" }),
      )
    },
  })
}

export const mcpServersMiddleware = { listenerMiddleware, registerListeners }
