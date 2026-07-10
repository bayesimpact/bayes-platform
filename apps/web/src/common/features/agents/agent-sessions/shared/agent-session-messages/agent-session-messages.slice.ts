import type { AgentSessionToolName } from "@caseai-connect/api-contracts"
import { createSlice, isAnyOf, type PayloadAction } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import { conversationAgentSessionsActions } from "../../conversation/conversation-agent-sessions.slice"
import { formAgentSessionsActions } from "../../form/form-agent-sessions.slice"
import type { AgentSessionMessage } from "./agent-session-messages.models"
import { getMessage, listMessages } from "./agent-session-messages.thunks"

type State = {
  data: AsyncData<AgentSessionMessage[]>
  isStreaming: boolean
  /** Ordered tools the agent has run during the current streaming turn, driving the status timeline. */
  streamingToolSteps: AgentSessionToolName[]
}

const initialState: State = {
  data: defaultAsyncData,
  isStreaming: false,
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
      }>,
    ) => {
      if (!ADS.isFulfilled(state.data))
        state.data = { value: [], status: ADS.Fulfilled, error: null }

      state.isStreaming = true
      state.streamingToolSteps = []
      state.data.value.push(action.payload.userMessage)
      state.data.value.push({
        id: action.payload.assistantMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
      })
    },
    updateAssistantMessageId: (
      state,
      action: PayloadAction<{ oldMessageId: string; newMessageId: string }>,
    ) => {
      if (!ADS.isFulfilled(state.data)) return

      const message = state.data.value.find((msg) => msg.id === action.payload.oldMessageId)
      if (message && message.role === "assistant" && message.status === "streaming") {
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
          message.completedAt = new Date().toISOString()
        }
      }
      state.isStreaming = false
      state.streamingToolSteps = []
    },
    failAssistantMessage: (state, action: PayloadAction<{ messageId: string; error: string }>) => {
      if (!ADS.isFulfilled(state.data)) return

      const message = state.data.value.find((msg) => msg.id === action.payload.messageId)
      if (message && message.role === "assistant") {
        message.status = "error"
        message.content = action.payload.error
        if (message.completedAt === undefined) {
          message.completedAt = new Date().toISOString()
        }
      }
      state.isStreaming = false
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
        state.data = {
          value: action.payload,
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
      const messageIndex = state.data.value.findIndex((msg) => msg.id === updatedMessage.id)
      if (messageIndex !== -1) {
        state.data.value[messageIndex] = updatedMessage
      }
    })

    // Reset messages state when an agent session is unmounted
    builder.addMatcher(
      isAnyOf(
        conversationAgentSessionsActions.sessionUnmount,
        formAgentSessionsActions.sessionUnmount,
      ),
      () => initialState,
    )
  },
})

export type { State as agentSessionMessagesState }
export const agentSessionMessagesInitialState = initialState
export const agentSessionMessagesActions = { ...slice.actions }
export const agentSessionMessagesSlice = slice
