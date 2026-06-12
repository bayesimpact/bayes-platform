import { createListenerMiddleware } from "@reduxjs/toolkit"
import { notificationsActions } from "@/common/features/notifications/notifications.slice"
import type { AppDispatch, RootState } from "@/common/store/types"
import { getCurrentId } from "../../helpers"
import { extractionAgentSessionsActions } from "../agent-sessions/extraction/extraction-agent-sessions.slice"
import {
  startCsvRunStatusStream,
  stopCsvRunStatusStream,
  syncCsvRunStatusStreamWithRuns,
} from "./agent-csv-extraction-run-stream-status"
import {
  selectCurrentCsvRecordsQuery,
  selectCurrentCsvRunId,
} from "./agent-csv-extraction-runs.selectors"
import { agentCsvExtractionRunsActions } from "./agent-csv-extraction-runs.slice"

const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

function registerListeners() {
  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.mount,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const runId = selectCurrentCsvRunId(state)
      if (!runId) return

      // The run object itself comes from the extraction sessions list; here we
      // only kick off the live status stream for the viewed run.
      listenerApi.dispatch(agentCsvExtractionRunsActions.startRunStatusStream())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.unmount,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(agentCsvExtractionRunsActions.stopRunStatusStream())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.createAndExecute.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "CSV extraction run started",
          type: "info",
        }),
      )
      // The created run is added to the extraction sessions list by the
      // extraction slice; here we only start streaming its status.
      listenerApi.dispatch(agentCsvExtractionRunsActions.startRunStatusStream())
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.createAndExecute.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({
          title: "CSV extraction run failed to start",
          type: "error",
        }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.startRunStatusStream,
    effect: async (_, listenerApi) => {
      await startCsvRunStatusStream(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.stopRunStatusStream,
    effect: async () => {
      stopCsvRunStatusStream()
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.patchRunStatus,
    effect: async (action, listenerApi) => {
      const { status, agentCsvExtractionRunId } = action.payload
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })

      // Refresh records only for the run currently being viewed (the stored
      // pagination query belongs to that run).
      if (agentCsvExtractionRunId === selectCurrentCsvRunId(state)) {
        const query = selectCurrentCsvRecordsQuery(state)
        listenerApi.dispatch(
          agentCsvExtractionRunsActions.getRecords({ agentId, agentCsvExtractionRunId, ...query }),
        )
      }

      switch (status) {
        case "completed": {
          await listenerApi.dispatch(extractionAgentSessionsActions.getAll({ agentId }))
          listenerApi.dispatch(
            notificationsActions.show({
              title: "CSV extraction run completed successfully",
              type: "success",
            }),
          )
          break
        }
        case "failed": {
          await listenerApi.dispatch(extractionAgentSessionsActions.getAll({ agentId }))
          listenerApi.dispatch(
            notificationsActions.show({
              title: "CSV extraction run failed",
              type: "error",
            }),
          )
          break
        }
        default:
          break
      }

      syncCsvRunStatusStreamWithRuns(listenerApi)
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.deleteOne.fulfilled,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      await listenerApi.dispatch(extractionAgentSessionsActions.getAll({ agentId }))

      listenerApi.dispatch(
        notificationsActions.show({ title: "Extraction deleted successfully", type: "success" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.deleteOne.rejected,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(
        notificationsActions.show({ title: "Extraction deletion failed", type: "error" }),
      )
    },
  })

  listenerMiddleware.startListening({
    actionCreator: agentCsvExtractionRunsActions.cancelOne.fulfilled,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(notificationsActions.show({ title: "Run cancelled", type: "success" }))
      stopCsvRunStatusStream()

      const state = listenerApi.getState()
      const agentId = getCurrentId({ state, name: "agentId" })
      listenerApi.dispatch(extractionAgentSessionsActions.getAll({ agentId }))
    },
  })
}

export const agentCsvExtractionRunsMiddleware = { listenerMiddleware, registerListeners }
