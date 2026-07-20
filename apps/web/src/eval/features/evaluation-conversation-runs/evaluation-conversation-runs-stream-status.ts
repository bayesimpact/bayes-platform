import { createStreamStatusManager } from "@/common/sse/stream-status-manager"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  selectHasConversationRunsInProgress,
  selectIsConversationRunStatusStreamActive,
} from "./evaluation-conversation-runs.selectors"
import { evaluationConversationRunsActions } from "./evaluation-conversation-runs.slice"

type AbortableStreamTask = { abort: () => void; unwrap: () => Promise<void> }
type StreamListenerApi = {
  dispatch: AppDispatch
  getState: () => RootState
}

const manager = createStreamStatusManager({
  selectIsStreamActive: selectIsConversationRunStatusStreamActive,
  selectHasItemsInProgress: selectHasConversationRunsInProgress,
  dispatchStreamThunk: (listenerApi) => {
    return listenerApi.dispatch(
      evaluationConversationRunsActions.streamRunStatus(),
    ) as unknown as AbortableStreamTask
  },
})

export function stopConversationRunStatusStream() {
  manager.stop()
}

export function syncConversationRunStatusStreamWithRuns(listenerApi: StreamListenerApi): void {
  manager.sync(listenerApi)
}

export async function startConversationRunStatusStream(
  listenerApi: StreamListenerApi,
): Promise<void> {
  await manager.start(listenerApi)
}
