import { createStreamStatusManager } from "@/common/sse/stream-status-manager"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  selectHasProjectEmbeddingModelsInProgress,
  selectIsProjectEmbeddingModelsProgressStreamActive,
} from "./project-embedding-models.selectors"
import {
  listProjectEmbeddingModels,
  streamProjectEmbeddingModelProgress,
} from "./project-embedding-models.thunks"

type AbortableStreamTask = { abort: () => void; unwrap: () => Promise<void> }
type StreamListenerApi = {
  dispatch: AppDispatch
  getState: () => RootState
}

const progressManager = createStreamStatusManager({
  selectIsStreamActive: selectIsProjectEmbeddingModelsProgressStreamActive,
  selectHasItemsInProgress: selectHasProjectEmbeddingModelsInProgress,
  dispatchStreamThunk: (listenerApi) =>
    listenerApi.dispatch(streamProjectEmbeddingModelProgress()) as unknown as AbortableStreamTask,
  dispatchRefresh: (listenerApi) => listenerApi.dispatch(listProjectEmbeddingModels()),
})

export function stopProjectEmbeddingModelsProgressStream() {
  progressManager.stop()
}

export function syncProjectEmbeddingModelsProgressStream(listenerApi: StreamListenerApi): void {
  progressManager.sync(listenerApi)
}

export async function startProjectEmbeddingModelsProgressStream(
  listenerApi: StreamListenerApi,
): Promise<void> {
  await progressManager.start(listenerApi)
}
