import { createStreamStatusManager } from "@/common/sse/stream-status-manager"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  selectHasDocumentsInProgress,
  selectIsEmbeddingStatusStreamActive,
} from "./documents.selectors"
import { listDocuments, streamDocumentEmbeddingStatuses } from "./documents.thunks"

type AbortableStreamTask = { abort: () => void; unwrap: () => Promise<void> }
type StreamListenerApi = {
  dispatch: AppDispatch
  getState: () => RootState
}

const embeddingManager = createStreamStatusManager({
  selectIsStreamActive: selectIsEmbeddingStatusStreamActive,
  selectHasItemsInProgress: selectHasDocumentsInProgress,
  dispatchStreamThunk: (listenerApi) =>
    listenerApi.dispatch(streamDocumentEmbeddingStatuses()) as unknown as AbortableStreamTask,
  dispatchRefresh: (listenerApi) => listenerApi.dispatch(listDocuments()),
})

export function stopDocumentEmbeddingStatusStream() {
  embeddingManager.stop()
}

export function syncDocumentEmbeddingStatusStreamWithDocuments(
  listenerApi: StreamListenerApi,
): void {
  embeddingManager.sync(listenerApi)
}

export async function handleDocumentsContextChanged(listenerApi: StreamListenerApi): Promise<void> {
  if (!listenerApi.getState().documents.currentSourceType) return
  await listenerApi.dispatch(listDocuments())
  syncDocumentEmbeddingStatusStreamWithDocuments(listenerApi)
}

export async function startDocumentEmbeddingStatusStream(
  listenerApi: StreamListenerApi,
): Promise<void> {
  await embeddingManager.start(listenerApi)
}
