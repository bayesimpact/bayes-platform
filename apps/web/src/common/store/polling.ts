import type { AnyListenerPredicate, ListenerEffectAPI } from "@reduxjs/toolkit"
import type { AppDispatch, RootState } from "./types"

type ListenerApi = ListenerEffectAPI<RootState, AppDispatch>

interface StartPollingOptions {
  /**
   * Predicate that resolves the polling loop when it matches — typically the
   * `.match` of an unmount action (e.g. `meActions.unmountOnboarding.match`).
   */
  stopWhen: AnyListenerPredicate<RootState>
  /** Delay between polls, in milliseconds. */
  intervalMs: number
  /** Runs immediately when polling starts, then after every interval. */
  poll: () => void
  /**
   * Whether to run `poll` once immediately when polling starts. When `false`,
   * the first poll happens after `intervalMs`. Defaults to `true`.
   */
  pollImmediately?: boolean
}

/**
 * Runs a polling loop from inside a listener effect until `stopWhen` matches.
 *
 * Fetches immediately, then repeats every `intervalMs` while the effect stays
 * active. Cancels any previously started loop so a single one runs even if the
 * start action is dispatched several times.
 *
 * ```ts
 * listenerMiddleware.startListening({
 *   actionCreator: meActions.mountOnboarding,
 *   effect: (_, listenerApi) =>
 *     startPolling(listenerApi, {
 *       stopWhen: meActions.unmountOnboarding.match,
 *       intervalMs: 30_000,
 *       poll: () => listenerApi.dispatch(fetchPendingInvitations()),
 *     }),
 * })
 * ```
 */
export async function startPolling(
  listenerApi: ListenerApi,
  { stopWhen, intervalMs, poll, pollImmediately = true }: StartPollingOptions,
): Promise<void> {
  // Ensure a single polling loop runs even if the start action fires several times.
  listenerApi.cancelActiveListeners()

  // Poll immediately, then repeat while the effect stays active.
  if (pollImmediately) poll()

  const pollingTask = listenerApi.fork(async (forkApi) => {
    while (true) {
      await forkApi.delay(intervalMs)
      poll()
    }
  })

  // Stop polling once the stop condition matches.
  await listenerApi.condition(stopWhen)
  pollingTask.cancel()
}
