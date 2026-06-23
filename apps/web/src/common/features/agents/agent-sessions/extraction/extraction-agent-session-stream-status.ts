import { createStreamStatusManager } from "@/common/sse/stream-status-manager"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  selectHasExtractionSessionsInProgress,
  selectIsExtractionSessionStatusStreamActive,
} from "./extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "./extraction-agent-sessions.slice"

type AbortableStreamTask = { abort: () => void; unwrap: () => Promise<void> }
type StreamListenerApi = {
  dispatch: AppDispatch
  getState: () => RootState
}

const manager = createStreamStatusManager({
  selectIsStreamActive: selectIsExtractionSessionStatusStreamActive,
  selectHasItemsInProgress: selectHasExtractionSessionsInProgress,
  dispatchStreamThunk: (listenerApi) => {
    return listenerApi.dispatch(
      extractionAgentSessionsActions.streamSessionStatus(),
    ) as unknown as AbortableStreamTask
  },
})

export function stopExtractionSessionStatusStream() {
  manager.stop()
}

export function syncExtractionSessionStatusStreamWithSessions(
  listenerApi: StreamListenerApi,
): void {
  manager.sync(listenerApi)
}

export async function startExtractionSessionStatusStream(
  listenerApi: StreamListenerApi,
): Promise<void> {
  await manager.start(listenerApi)
}
