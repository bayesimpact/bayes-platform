import { createListenerMiddleware } from "@reduxjs/toolkit"
import { ADS } from "@/common/store/async-data-status"
import type { AppDispatch, RootState } from "@/common/store/types"
import { agentSessionMessagesActions, isStreamingReply } from "./agent-session-messages.slice"
import { getMessage, listMessages } from "./agent-session-messages.thunks"

export const listenerMiddleware = createListenerMiddleware<RootState, AppDispatch>()

/**
 * How often a reply loaded mid-stream is re-fetched. The server settles the message on its own
 * when the answer completes, fails, or is found orphaned, so the loop only has to notice.
 */
export const STREAMING_RECOVERY_POLL_INTERVAL_MS = 2_000

/**
 * Polls that may fail in a row before the reply is given up on. A single failed read (network
 * blip, token refresh) says nothing about the reply, which the server is still writing.
 */
export const STREAMING_RECOVERY_MAX_CONSECUTIVE_FAILURES = 3

/**
 * Longest a reply is followed before it is shown as interrupted. The server settles an orphaned
 * reply within its own window, so this only guards against that never happening; it is generous
 * enough for the longest legitimate turn.
 */
export const STREAMING_RECOVERY_MAX_WAIT_MS = 30 * 60 * 1000

/** Nobody is looking: skip the poll and catch up on the next visible tick. */
const isTabHidden = () => typeof document !== "undefined" && document.hidden

const findStreamingReply = (state: RootState) => {
  const { data } = state.agentSessionMessages
  return ADS.isFulfilled(data) ? data.value.find(isStreamingReply) : undefined
}

function registerListeners() {
  // A page refresh while the agent writes closes the SSE stream, but the server keeps writing and
  // persists the outcome. Loading such a reply used to render a spinner nothing would ever
  // resolve; instead re-fetch it until the server reports it settled.
  listenerMiddleware.startListening({
    actionCreator: listMessages.fulfilled,
    effect: async (_, listenerApi) => {
      // Decided on the thread the reducer produced, not on the payload: a list the reducer set
      // aside because a reply is being written here must not start a loop against it.
      const streamingReply = findStreamingReply(listenerApi.getState())
      if (!streamingReply) return

      // A reply that was already streaming before this list is either streamed live over SSE
      // or already followed by a running loop. Only a reply the list introduced needs one.
      const previousReply = findStreamingReply(listenerApi.getOriginalState())
      if (previousReply?.id === streamingReply.id) return

      // One loop per thread, even if the list is reloaded while a loop already runs.
      listenerApi.cancelActiveListeners()

      // The loop follows this one persisted reply only. A turn the user sends after it settles
      // is streamed live over SSE under an optimistic id the server does not know: polling it
      // would fail and kill the live reply.
      const messageId = streamingReply.id
      const giveUpAt = Date.now() + STREAMING_RECOVERY_MAX_WAIT_MS
      let consecutiveFailures = 0

      // The reply cannot be followed any more: better shown interrupted than a spinner for good.
      const giveUp = () => {
        listenerApi.dispatch(agentSessionMessagesActions.interruptAssistantMessage({ messageId }))
      }

      // Whether the reply is still being written, as far as the client knows. Leaving the
      // session resets the slice, which is how the loop learns to stop.
      const isStillStreaming = () => {
        const { data } = listenerApi.getState().agentSessionMessages
        if (!ADS.isFulfilled(data)) return false
        const reply = data.value.find((message) => message.id === messageId)
        return reply !== undefined && isStreamingReply(reply)
      }

      while (true) {
        await listenerApi.delay(STREAMING_RECOVERY_POLL_INTERVAL_MS)
        if (!isStillStreaming()) return
        if (isTabHidden()) continue

        const result = await listenerApi.dispatch(getMessage(messageId))
        if (!isStillStreaming()) return

        if (getMessage.rejected.match(result)) {
          consecutiveFailures += 1
          if (consecutiveFailures >= STREAMING_RECOVERY_MAX_CONSECUTIVE_FAILURES) return giveUp()
          continue
        }
        consecutiveFailures = 0

        // Decided on a fresh answer only: a tab left hidden past the deadline must not declare
        // interrupted a reply the server has since completed.
        if (Date.now() > giveUpAt) return giveUp()
      }
    },
  })
}

export const agentSessionMessagesMiddleware = { listenerMiddleware, registerListeners }
