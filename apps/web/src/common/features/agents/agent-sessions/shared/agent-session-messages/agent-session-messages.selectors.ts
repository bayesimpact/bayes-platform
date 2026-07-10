import type { RootState } from "@/common/store"

export const selectCurrentMessagesData = (state: RootState) => state.agentSessionMessages.data

export const selectStreaming = (state: RootState) => state.agentSessionMessages.isStreaming

export const selectStreamingToolSteps = (state: RootState) =>
  state.agentSessionMessages.streamingToolSteps
