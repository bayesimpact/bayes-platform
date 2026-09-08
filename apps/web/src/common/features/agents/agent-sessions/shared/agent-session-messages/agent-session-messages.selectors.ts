import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import { hasStreamingReply } from "./agent-session-messages.slice"

export const selectCurrentMessagesData = (state: RootState) => state.agentSessionMessages.data

/** Whether a reply is being written, live over SSE or recovered after a refresh. */
export const selectStreaming = (state: RootState) => {
  const { data } = state.agentSessionMessages
  return ADS.isFulfilled(data) && hasStreamingReply(data.value)
}

export const selectStreamingToolSteps = (state: RootState) =>
  state.agentSessionMessages.streamingToolSteps
