import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { listAgentSettingsWithDraft } from "@/common/features/agents/agent-settings/agent-settings.thunks"
import { listAgents } from "@/common/features/agents/agents.thunks"
import { fetchMe } from "@/common/features/me/me.thunks"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  createAgent,
  deleteAgent,
  duplicateAgent,
  updateAgent,
} from "@/studio/features/agents/agents.thunks"
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
      listenerApi.dispatch(listAgents({ includeDrafts: true }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: updateAgent.fulfilled,
    effect: async (action, listenerApi) => {
      const agentId = action.meta.arg.agentId
      // No success notification: the agent editor saves the name by itself and shows the state
      // of the save.
      await listenerApi.dispatch(listAgents({ includeDrafts: true }))
      await listenerApi.dispatch(listAgentSettingsWithDraft({ agentId }))
    },
  })
  listenerMiddleware.startListening({
    actionCreator: updateAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agent:notifications.updateError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteAgent.fulfilled,
    effect: async (_, listenerApi) => {
      await listenerApi.dispatch(listAgents({ includeDrafts: true }))

      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agent:notifications.deleted",
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
          titleKey: "agent:notifications.deleteError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createAgent.fulfilled,
    effect: async (action, listenerApi) => {
      const agentId = action.payload.id
      await listenerApi.dispatch(listAgents({ includeDrafts: true }))
      await listenerApi.dispatch(listAgentSettingsWithDraft({ agentId }))
      // The new agent is a draft: its owner membership must reach the abilities before its
      // editor opens, as for a copy.
      await listenerApi.dispatch(fetchMe())

      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agent:notifications.created",
          type: "success",
        }),
      )

      action.meta.arg.onSuccess?.(action.payload)
    },
  })
  listenerMiddleware.startListening({
    actionCreator: duplicateAgent.fulfilled,
    effect: async (action, listenerApi) => {
      const agentId = action.payload.id
      await listenerApi.dispatch(listAgents({ includeDrafts: true }))
      await listenerApi.dispatch(listAgentSettingsWithDraft({ agentId }))
      // The copy's owner membership must reach the abilities before its editor opens.
      await listenerApi.dispatch(fetchMe())

      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agent:notifications.duplicated",
          type: "success",
        }),
      )

      action.meta.arg.onSuccess?.(action.payload)
    },
  })
  listenerMiddleware.startListening({
    actionCreator: duplicateAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agent:notifications.duplicateError",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: createAgent.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          titleKey: "agent:notifications.createError",
          type: "error",
        }),
      )
    },
  })
}
export const studioAgentsMiddleware = { listenerMiddleware, registerListeners }
