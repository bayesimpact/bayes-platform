import { createStreamStatusManager } from "@/common/sse/stream-status-manager"
import type { AppDispatch, RootState } from "@/common/store/types"
import {
  selectHasDocumentsCrawling,
  selectHasDocumentsInProgress,
  selectIsCrawlProgressStreamActive,
  selectIsEmbeddingStatusStreamActive,
} from "./documents.selectors"
import {
  listDocuments,
  streamDocumentCrawlProgresses,
  streamDocumentEmbeddingStatuses,
} from "./documents.thunks"

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

const crawlProgressManager = createStreamStatusManager({
  selectIsStreamActive: selectIsCrawlProgressStreamActive,
  selectHasItemsInProgress: selectHasDocumentsCrawling,
  dispatchStreamThunk: (listenerApi) =>
    listenerApi.dispatch(streamDocumentCrawlProgresses()) as unknown as AbortableStreamTask,
  dispatchRefresh: (listenerApi) => listenerApi.dispatch(listDocuments()),
})

export function stopDocumentEmbeddingStatusStream() {
  embeddingManager.stop()
}

export function stopDocumentCrawlProgressStream() {
  crawlProgressManager.stop()
}

export function syncDocumentEmbeddingStatusStreamWithDocuments(
  listenerApi: StreamListenerApi,
): void {
  embeddingManager.sync(listenerApi)
  crawlProgressManager.sync(listenerApi)
}

export async function handleDocumentsContextChanged(listenerApi: StreamListenerApi): Promise<void> {
  await listenerApi.dispatch(listDocuments())
  syncDocumentEmbeddingStatusStreamWithDocuments(listenerApi)
}

export async function startDocumentEmbeddingStatusStream(
  listenerApi: StreamListenerApi,
): Promise<void> {
  await embeddingManager.start(listenerApi)
}

export async function startDocumentCrawlProgressStream(
  listenerApi: StreamListenerApi,
): Promise<void> {
  await crawlProgressManager.start(listenerApi)
}
