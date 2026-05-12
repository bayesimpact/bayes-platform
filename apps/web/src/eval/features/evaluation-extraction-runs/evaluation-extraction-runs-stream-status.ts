import { createStreamStatusManager } from "@/common/sse/stream-status-manager"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  selectHasRunsInProgress,
  selectIsRunStatusStreamActive,
} from "./evaluation-extraction-runs.selectors"
import { evaluationExtractionRunsActions } from "./evaluation-extraction-runs.slice"

type AbortableStreamTask = { abort: () => void; unwrap: () => Promise<void> }
type StreamListenerApi = {
  dispatch: AppDispatch
  getState: () => RootState
}

const manager = createStreamStatusManager({
  selectIsStreamActive: selectIsRunStatusStreamActive,
  selectHasItemsInProgress: selectHasRunsInProgress,
  dispatchStreamThunk: (listenerApi) => {
    return listenerApi.dispatch(
      evaluationExtractionRunsActions.streamRunStatus(),
    ) as unknown as AbortableStreamTask
  },
})

export function stopRunStatusStream() {
  manager.stop()
}

export function syncRunStatusStreamWithRuns(listenerApi: StreamListenerApi): void {
  manager.sync(listenerApi)
}

export async function startRunStatusStream(listenerApi: StreamListenerApi): Promise<void> {
  await manager.start(listenerApi)
}
