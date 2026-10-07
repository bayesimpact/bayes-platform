import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { listAgentSettingsWithDraft } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { listAgents } from "@/common/features/agents/agents.thunks"
import { fetchMe } from "@/common/features/me/me.thunks"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { createAgent, deleteAgent, updateAgent } from "@/studio/features/agents/agents.thunks"
import {
  deleteDocumentTag,
  updateDocumentTag,
} from "@/studio/features/document-tags/document-tags.thunks"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    matcher: isAnyOf(
      // DocumentTag changes
      updateDocumentTag.fulfilled,
      deleteDocumentTag.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listAgents())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: updateAgent.fulfilled,
    effect: async (action, listenerApi) => {
      const agentId = action.meta.arg.agentId
      await listenerApi.dispatch(listAgents())
      await listenerApi.dispatch(listAgentSettingsWithDraft({ agentId }))

      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent updated successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: updateAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent update failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteAgent.fulfilled,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listAgents())

      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent deleted successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent deletion failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createAgent.fulfilled,
    effect: async (action, listenerApi) => {
      const agentId = action.payload.id
      await listenerApi.dispatch(listAgents())
      await listenerApi.dispatch(listAgentSettingsWithDraft({ agentId }))

      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent created successfully",
          type: "success",
        }),
      )

      const onSuccess = action.meta.arg.onSuccess
      onSuccess?.(action.payload)

      listenerApi.dispatch(fetchMe()) // To update agent membership and then abilities
    },
  })
  listenerMiddleware.startListening({
    actionCreator: createAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent creation failed",
          type: "error",
        }),
      )
    },
  })
}
export const studioAgentsMiddleware = { listenerMiddleware, registerListeners }
