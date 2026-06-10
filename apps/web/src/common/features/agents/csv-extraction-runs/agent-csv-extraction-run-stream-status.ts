import { createStreamStatusManager } from "@/common/sse/stream-status-manager"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  selectHasCsvRunsInProgress,
  selectIsCsvRunStatusStreamActive,
} from "./agent-csv-extraction-runs.selectors"
import { agentCsvExtractionRunsActions } from "./agent-csv-extraction-runs.slice"

type AbortableStreamTask = { abort: () => void; unwrap: () => Promise<void> }
type StreamListenerApi = {
  dispatch: AppDispatch
  getState: () => RootState
}

const manager = createStreamStatusManager({
  selectIsStreamActive: selectIsCsvRunStatusStreamActive,
  selectHasItemsInProgress: selectHasCsvRunsInProgress,
  dispatchStreamThunk: (listenerApi) => {
    return listenerApi.dispatch(
      agentCsvExtractionRunsActions.streamRunStatus(),
    ) as unknown as AbortableStreamTask
  },
})

export function stopCsvRunStatusStream() {
  manager.stop()
}

export function syncCsvRunStatusStreamWithRuns(listenerApi: StreamListenerApi): void {
  manager.sync(listenerApi)
}

export async function startCsvRunStatusStream(listenerApi: StreamListenerApi): Promise<void> {
  await manager.start(listenerApi)
}
