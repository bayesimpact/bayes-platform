import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Agent } from "../../agents.models"
import { listAgents } from "../../agents.thunks"
import { createAgentChatSession } from "../shared/base-agent-session/base-agent-sessions.thunks"
import type { ConversationAgentSession } from "./conversation-agent-sessions.models"
import { conversationAgentSessionsThunks } from "./conversation-agent-sessions.thunks"

type DataType = Record<Agent["id"], AsyncData<ConversationAgentSession[]>> // keyed by agentId
type State = {
  data: DataType
}

const initialState: State = {
  data: {},
}

const slice = createSlice({
  name: "conversationAgentSessions",
  initialState,
  reducers: {
    mount: () => {},
    unmount: () => {},
    sessionMount: () => {},
    sessionUnmount: () => {},
    reset: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(listAgents.fulfilled, (state, action) => {
      const conversationAgents = action.payload.filter((agent) => agent.type === "conversation")
      const agentIds = conversationAgents.map((agent) => agent.id)

      // Remove any agent sessions that don't have a corresponding agent anymore
      Object.keys(state.data).forEach((agentId) => {
        if (!agentIds.includes(agentId)) {
          delete state.data[agentId]
        }
      })

      // Initialize state for any new conversation agents
      state.data = conversationAgents.reduce((acc, agent) => {
        acc[agent.id] = state.data[agent.id] || defaultAsyncData
        return acc
      }, {} as DataType)
    })

    builder.addCase(createAgentChatSession.pending, (state, action) => {
      if (action.meta.arg.agentType !== "conversation") return
      const agentId = action.meta.arg.agentId
      state.data[agentId] = { status: ADS.Loading, value: null, error: null }
    })

    builder
      .addCase(conversationAgentSessionsThunks.getAll.pending, (state, action) => {
        const agentId = action.meta.arg.agentId
        const sessions = state.data[agentId]
        if (sessions && ADS.isFulfilled(sessions)) return
        state.data[agentId] = { status: ADS.Loading, value: null, error: null }
      })
      .addCase(conversationAgentSessionsThunks.getAll.fulfilled, (state, action) => {
        const agentId = action.meta.arg.agentId
        state.data[agentId] = { status: ADS.Fulfilled, value: action.payload, error: null }
      })
      .addCase(conversationAgentSessionsThunks.getAll.rejected, (state, action) => {
        const agentId = action.meta.arg.agentId
        state.data[agentId] = {
          status: ADS.Error,
          value: null,
          error: action.error.message || "Failed to load conversation sessions",
        }
      })
  },
})

export type { State as conversationAgentSessionsState }
export const conversationAgentSessionsInitialState = initialState
export const conversationAgentSessionsActions = {
  ...slice.actions,
  ...conversationAgentSessionsThunks,
}
export const conversationAgentSessionsSlice = slice
