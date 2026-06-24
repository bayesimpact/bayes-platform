import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store"
import { agentCsvExtractionRunsThunks } from "../../csv-extraction-runs/agent-csv-extraction-runs.thunks"
import { deleteAgentSession } from "../shared/base-agent-session/base-agent-sessions.thunks"
import {
  startExtractionSessionStatusStream,
  stopExtractionSessionStatusStream,
  syncExtractionSessionStatusStreamWithSessions,
} from "./extraction-agent-session-stream-status"
import { patchExtractionSessionStatus } from "./extraction-agent-sessions.actions"
import { selectHasExtractionSessionsInProgress } from "./extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "./extraction-agent-sessions.slice"

export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

const { mount, sessionMount, executeOne, listMyDocuments, deleteMyDocuments, getAll } =
  extractionAgentSessionsActions

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      await listenerApi.dispatch(getAll({ agentId }))
    },
  })
  listenerMiddleware.startListening({
    actionCreator: sessionMount,
    effect: async (_, listenerApi) => {
      if (selectHasExtractionSessionsInProgress(listenerApi.getState())) {
        listenerApi.dispatch(extractionAgentSessionsActions.startSessionStatusStream())
      }
    },
  })

  listenerMiddleware.startListening({
    matcher: isAnyOf(
      mount,
      executeOne.rejected,
      agentCsvExtractionRunsThunks.uploadCsvFile.fulfilled,
    ),
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(listMyDocuments())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: executeOne.fulfilled,
    effect: async (action, listenerApi) => {
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      await listenerApi.dispatch(getAll({ agentId }))

      action.meta.arg.onSuccess?.(action.payload.runId)

      listenerApi.dispatch(listMyDocuments())

      // Start the SSE stream to watch for the terminal status
      listenerApi.dispatch(extractionAgentSessionsActions.startSessionStatusStream())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: extractionAgentSessionsActions.startSessionStatusStream,
    effect: async (_, listenerApi) => {
      await startExtractionSessionStatusStream(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: extractionAgentSessionsActions.stopSessionStatusStream,
    effect: async () => {
      stopExtractionSessionStatusStream()
    },
  })

  listenerMiddleware.startListening({
    actionCreator: patchExtractionSessionStatus,
    effect: async (action, listenerApi) => {
      const { status, agentId } = action.payload

      switch (status) {
        case "success": {
          await listenerApi.dispatch(getAll({ agentId }))
          listenerApi.dispatch(
            notificationsActions.show({
              title: "Extraction completed successfully",
              type: "success",
            }),
          )
          break
        }
        case "failed": {
          await listenerApi.dispatch(getAll({ agentId }))
          listenerApi.dispatch(
            notificationsActions.show({
              title: "Extraction failed",
              type: "error",
            }),
          )
          break
        }
        default:
          break
      }

      syncExtractionSessionStatusStreamWithSessions(listenerApi)
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
