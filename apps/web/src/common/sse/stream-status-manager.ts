import type { AppDispatch, RootState } from "@/common/store/types"

type AbortableStreamTask = { abort: () => void; unwrap: () => Promise<void> }
type StreamListenerApi = {
  dispatch: AppDispatch
  getState: () => RootState
}

export interface StreamStatusManagerConfig {
  selectIsStreamActive: (state: RootState) => boolean
  selectHasItemsInProgress: (state: RootState) => boolean
  dispatchStreamThunk: (listenerApi: StreamListenerApi) => AbortableStreamTask
  dispatchRefresh?: (listenerApi: StreamListenerApi) => void
}

export interface StreamStatusManager {
  stop: () => void
  sync: (listenerApi: StreamListenerApi) => void
  start: (listenerApi: StreamListenerApi) => Promise<void>
}

export function createStreamStatusManager(config: StreamStatusManagerConfig): StreamStatusManager {
  let streamTask: AbortableStreamTask | null = null
  let streamReconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let streamGeneration = 0

  function clearReconnectTimeout() {
    if (!streamReconnectTimeout) return
    clearTimeout(streamReconnectTimeout)
    streamReconnectTimeout = null
  }

  function stop() {
    streamGeneration += 1
    streamTask?.abort()
    streamTask = null
    clearReconnectTimeout()
  }

  function shouldKeepRunning(params: {
    listenerApi: StreamListenerApi
    generation: number
  }): boolean {
    if (params.generation !== streamGeneration) return false
    const state = params.listenerApi.getState()
    if (!config.selectIsStreamActive(state)) return false
    return true
  }

  async function waitForReconnectDelay(reconnectDelayMs: number): Promise<void> {
    await new Promise<void>((resolvePromise) => {
      streamReconnectTimeout = setTimeout(() => {
        streamReconnectTimeout = null
        resolvePromise()
      }, reconnectDelayMs)
    })
  }

  async function runStreamLoop(
    listenerApi: StreamListenerApi,
    generation: number,
    reconnectAttemptCount = 0,
  ) {
    if (!shouldKeepRunning({ listenerApi, generation })) {
      return
    }

    const task = config.dispatchStreamThunk(listenerApi)
    streamTask = task

    try {
      await task.unwrap()
      streamTask = null
      return
    } catch {
      streamTask = null
      if (!shouldKeepRunning({ listenerApi, generation })) {
        return
      }

      const nextReconnectAttemptCount = reconnectAttemptCount + 1
      const reconnectDelayMs = Math.min(15_000, 1_000 * 2 ** (nextReconnectAttemptCount - 1))
      await waitForReconnectDelay(reconnectDelayMs)

      if (!shouldKeepRunning({ listenerApi, generation })) {
        return
      }

      if (config.dispatchRefresh) {
        config.dispatchRefresh(listenerApi)
      }

      await runStreamLoop(listenerApi, generation, nextReconnectAttemptCount)
    }
  }

  function sync(listenerApi: StreamListenerApi): void {
    const state = listenerApi.getState()
    const shouldKeepStreamRunning =
      config.selectIsStreamActive(state) && config.selectHasItemsInProgress(state)

    if (!shouldKeepStreamRunning) {
      stop()
      return
    }

    if (streamTask) {
      return
    }

    const generation = streamGeneration
    void runStreamLoop(listenerApi, generation)
  }

  async function start(listenerApi: StreamListenerApi): Promise<void> {
    sync(listenerApi)
  }

  return { stop, sync, start }
}
