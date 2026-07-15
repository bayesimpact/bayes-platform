import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { listAgents } from "@/common/features/agents/agents.thunks"
import { fetchMe } from "@/common/features/me/me.thunks"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import { ADS } from "@/common/store/async-data-status"
import type { AppDispatch, RootState } from "@/common/store/types"
import { selectAgentHistoryData } from "@/studio/features/agents/agent-history.selectors"
import {
  listAgentHistory,
  restoreAgentRevision,
} from "@/studio/features/agents/agent-history.thunks"
import {
  createAgent,
  deleteAgent,
  updateAgentCategories,
  updateAgentGeneral,
  updateAgentModel,
  updateAgentOutput,
  updateAgentResources,
  updateAgentSources,
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
      listenerApi.dispatch(listAgents())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteAgent.fulfilled,
    effect: async (_, listenerApi) => {
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

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      updateAgentGeneral.fulfilled,
      updateAgentModel.fulfilled,
      updateAgentOutput.fulfilled,
      updateAgentSources.fulfilled,
      updateAgentResources.fulfilled,
      updateAgentCategories.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listAgents())

      // Keep the version history in sync when it has already been opened.
      if (ADS.isFulfilled(selectAgentHistoryData(listenerApi.getState()))) {
        listenerApi.dispatch(listAgentHistory())
      }

      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent updated successfully",
          type: "success",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: restoreAgentRevision.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listAgents())
      listenerApi.dispatch(listAgentHistory())

      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent version restored successfully",
          type: "success",
        }),
      )
    },
  })
  listenerMiddleware.startListening({
    actionCreator: restoreAgentRevision.rejected,
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
    matcher: isAnyOf(
      updateAgentGeneral.rejected,
      updateAgentModel.rejected,
      updateAgentOutput.rejected,
      updateAgentSources.rejected,
      updateAgentResources.rejected,
      updateAgentCategories.rejected,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Agent update failed",
          type: "error",
        }),
      )
    },
  })
}
export const studioAgentsMiddleware = { listenerMiddleware, registerListeners }
