import { ToolName } from "@caseai-connect/api-contracts"
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { agentSessionMessagesActions } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.slice"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { agentMemoriesActions } from "./agent-memories.slice"
import {
  clearAgentMemories,
  deleteAgentMemory,
  listAgentMemories,
  resolveAgentMemoryProposals,
} from "./agent-memories.thunks"

const MEMORY_TOOL_NAMES: string[] = [ToolName.SaveMemory, ToolName.ForgetMemory]

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: agentMemoriesActions.mount,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listAgentMemories())
    },
  })

  // The agent saved or forgot something during the turn: reload, so the
  // approval card and the memory panel show the new facts.
  listenerMiddleware.startListening({
    actionCreator: agentSessionMessagesActions.addStreamingToolStep,
    effect: async (action, listenerApi) => {
      if (!MEMORY_TOOL_NAMES.includes(action.payload.toolName)) return
      if (!listenerApi.getState().agentMemories?.mounted) return
      await listenerApi.dispatch(listAgentMemories())
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(resolveAgentMemoryProposals.fulfilled),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Memory updated",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      resolveAgentMemoryProposals.rejected,
      deleteAgentMemory.rejected,
      clearAgentMemories.rejected,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Memory update failed",
          type: "error",
        }),
      )
    },
  })
}

export const agentMemoriesMiddleware = { listenerMiddleware, registerListeners }
