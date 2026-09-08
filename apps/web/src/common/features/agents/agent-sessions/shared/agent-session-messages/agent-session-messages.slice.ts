import type { AgentSessionToolName } from "@caseai-connect/api-contracts"
import { createSlice, isAnyOf, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import { conversationAgentSessionsActions } from "../../conversation/conversation-agent-sessions.slice"
import type { AgentSessionMessage } from "./agent-session-messages.models"
import { getMessage, listMessages } from "./agent-session-messages.thunks"

/**
 * Whether a reply is being written is not stored: it is read off the messages (see
 * `selectStreaming`), so the composer lock can never drift from what the thread shows.
 */
type State = {
  data: AsyncData<AgentSessionMessage[]>
  /** Ordered tools the agent has run during the current streaming turn, driving the status timeline. */
  streamingToolSteps: AgentSessionToolName[]
}

const initialState: State = {
  data: defaultAsyncData,
  streamingToolSteps: [],
}

const slice = createSlice({
  name: "agentSessionMessages",
  initialState,
  reducers: {
    reset: () => initialState,
    startStreaming: (
      state,
      action: PayloadAction<{
        userMessage: AgentSessionMessage
        assistantMessageId: string
        /**
         * Settings version the request was sent with. Recorded on the message so its badge keeps
         * naming what produced it, even if the picker moves on before the refetch lands.
         */
        agentRevision?: number
      }>,
    ) => {
      if (!ADS.isFulfilled(state.data))
        state.data = { value: [], status: ADS.Fulfilled, error: null }

      state.streamingToolSteps = []
      state.data.value.push(action.payload.userMessage)
      state.data.value.push({
        id: action.payload.assistantMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
        agentRevision: action.payload.agentRevision,
      })
    },
    updateAssistantMessageId: (
      state,
      action: PayloadAction<{ oldMessageId: string; newMessageId: string }>,
    ) => {
      if (!ADS.isFulfilled(state.data)) return

      const message = state.data.value.find((msg) => msg.id === action.payload.oldMessageId)
      if (message && isStreamingReply(message)) {
        message.id = action.payload.newMessageId
      }
    },
    addStreamingToolStep: (state, action: PayloadAction<{ toolName: AgentSessionToolName }>) => {
      // Skip immediate duplicates so repeated notifications for the same tool
      // don't stack up as separate timeline steps.
      const lastStep = state.streamingToolSteps.at(-1)
      if (lastStep !== action.payload.toolName) {
        state.streamingToolSteps.push(action.payload.toolName)
      }
    },
    appendAssistantChunk: (state, action: PayloadAction<{ messageId: string; chunk: string }>) => {
      if (!ADS.isFulfilled(state.data)) return

      const message = state.data.value.find((msg) => msg.id === action.payload.messageId)
      if (message && message.role === "assistant") {
        message.content += action.payload.chunk
      }
    },
    completeAssistantMessage: (
      state,
      action: PayloadAction<{ messageId: string; fullContent: string }>,
    ) => {
      if (!ADS.isFulfilled(state.data)) return

      const message = state.data.value.find((msg) => msg.id === action.payload.messageId)
      if (message && message.role === "assistant") {
        message.content = action.payload.fullContent
        message.status = "completed"
        if (message.completedAt === undefined) {
          message.completedAt = Date.now()
        }
      }
      state.streamingToolSteps = []
    },
    failAssistantMessage: (state, action: PayloadAction<{ messageId: string; error: string }>) => {
      if (!ADS.isFulfilled(state.data)) return

      const message = state.data.value.find((msg) => msg.id === action.payload.messageId)
      if (message && message.role === "assistant") {
        message.status = "error"
        message.content = action.payload.error
        if (message.completedAt === undefined) {
          message.completedAt = Date.now()
        }
      }
      state.streamingToolSteps = []
    },
    /**
     * The reply can no longer be followed (see the recovery poll): shown as interrupted, with the
     * turn offered again, rather than as a spinner for good. Nothing written so far is kept.
     */
    interruptAssistantMessage: (state, action: PayloadAction<{ messageId: string }>) => {
      if (!ADS.isFulfilled(state.data)) return

      const message = state.data.value.find((msg) => msg.id === action.payload.messageId)
      if (message && isStreamingReply(message)) {
        message.status = "aborted"
        message.content = ""
      }
      state.streamingToolSteps = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(listMessages.pending, (state) => {
        if (!ADS.isFulfilled(state.data)) state.data.status = ADS.Loading
        state.data.error = null
      })
      .addCase(listMessages.fulfilled, (state, action) => {
        const localReply = ADS.isFulfilled(state.data)
          ? state.data.value.find(isStreamingReply)
          : undefined
        // A list fetched before the turn being written here was persisted knows nothing of it:
        // applying it would drop the optimistic turn and unlock the composer while the stream
        // still runs. The stream, or the recovery poll, settles the thread itself.
        if (localReply && !action.payload.some((message) => message.id === localReply.id)) return
        state.data = {
          // The server persists a reply's content at completion only, so while it still reports
          // the reply streaming the chunks received here are the fuller picture. A list that
          // shows it settled, on the other hand, is the outcome and replaces it.
          value: action.payload.map((message) =>
            localReply && message.id === localReply.id && isStreamingReply(message)
              ? { ...localReply }
              : message,
          ),
          status: ADS.Fulfilled,
          error: null,
        }
      })
      .addCase(listMessages.rejected, (state, action) => {
        state.data.status = ADS.Error
        state.data.error = action.error.message || "Failed to load session messages"
      })

    builder.addCase(getMessage.fulfilled, (state, action) => {
      if (!ADS.isFulfilled(state.data)) return
      const updatedMessage = action.payload
      // A snapshot of a reply still being written carries no content (it is persisted at
      // completion) and may even trail a completion the client already saw. Only a settled
      // snapshot may replace what the client holds.
      if (isStreamingReply(updatedMessage)) return
      const messageIndex = state.data.value.findIndex((msg) => msg.id === updatedMessage.id)
      if (messageIndex !== -1) {
        state.data.value[messageIndex] = updatedMessage
      }
    })

    // Reset messages state when an agent session is unmounted
    builder.addMatcher(isAnyOf(conversationAgentSessionsActions.sessionUnmount), () => initialState)
  },
})

/** An assistant reply still being written, live over SSE or recovered after a refresh. */
export const isStreamingReply = (message: AgentSessionMessage): boolean =>
  message.role === "assistant" && message.status === "streaming"

/** Whether an assistant reply in the thread is still being written. */
export const hasStreamingReply = (messages: AgentSessionMessage[]): boolean =>
  messages.some(isStreamingReply)

export type { State as agentSessionMessagesState }
export const agentSessionMessagesInitialState = initialState
export const agentSessionMessagesActions = { ...slice.actions }
export const agentSessionMessagesSlice = slice
