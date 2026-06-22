import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store"
import { agentCsvExtractionRunsThunks } from "../../csv-extraction-runs/agent-csv-extraction-runs.thunks"
import { deleteAgentSession } from "../shared/base-agent-session/base-agent-sessions.thunks"
import { extractionAgentSessionsActions } from "./extraction-agent-sessions.slice"

// Create typed listener middleware
export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

const { mount, executeOne, listMyDocuments, deleteMyDocuments, getAll } =
  extractionAgentSessionsActions

function registerListeners() {
  // Load conversation agent sessions when agent is loaded
  listenerMiddleware.startListening({
    actionCreator: mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      await listenerApi.dispatch(getAll({ agentId }))
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      mount,
      executeOne.fulfilled,
      executeOne.rejected,
      agentCsvExtractionRunsThunks.uploadCsvFile.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listMyDocuments())
    },
  })

  // Refresh extraction agent sessions when create a new run
  listenerMiddleware.startListening({
    matcher: isAnyOf(executeOne.fulfilled, executeOne.rejected),
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      await listenerApi.dispatch(getAll({ agentId }))
    },
  })

  listenerMiddleware.startListening({
    actionCreator: executeOne.fulfilled,
    effect: async (action, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Extraction executed successfully",
          type: "success",
        }),
      )

      action.meta.arg.onSuccess?.()
    },
  })
  listenerMiddleware.startListening({
    actionCreator: executeOne.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Extraction execution failed",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteMyDocuments.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Document(s) deleted successfully",
          type: "success",
        }),
      )
      listenerApi.dispatch(listMyDocuments())
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteMyDocuments.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "Failed to delete document(s)",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: deleteAgentSession.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.agentType !== "extraction") return

      listenerApi.dispatch(
        notificationsActions.show({
          title: "Extraction deleted successfully",
          type: "success",
        }),
      )

      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      await listenerApi.dispatch(getAll({ agentId }))
    },
  })
  listenerMiddleware.startListening({
    actionCreator: deleteAgentSession.rejected,
    effect: async (action, listenerApi) => {
      if (action.meta.arg.agentType !== "extraction") return

      listenerApi.dispatch(
        notificationsActions.show({
          title: "Extraction deletion failed",
          type: "error",
        }),
      )
    },
  })
}

export const extractionAgentSessionsMiddleware = {
  listenerMiddleware,
  registerListeners,
}
