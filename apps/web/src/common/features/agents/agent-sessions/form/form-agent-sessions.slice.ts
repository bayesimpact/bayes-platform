import { createSlice } from "@reduxjs/toolkit"
import { ADS, type AsyncData, defaultAsyncData } from "@/common/store/async-data-status"
import type { Agent } from "../../agents.models"
import { listAgents } from "../../agents.thunks"
import { createAgentChatSession } from "../shared/base-agent-session/base-agent-sessions.thunks"
import type { FormAgentSession, FormSubSession } from "./form-agent-sessions.models"
import { formAgentSessionsThunks } from "./form-agent-sessions.thunks"

type DataType = Record<Agent["id"], AsyncData<FormAgentSession[]>> // keyed by agentId
// Form sub-sessions delegated by a parent agent session, keyed by parent session id.
type SubSessionsType = Record<string, AsyncData<FormSubSession[]>>
type State = {
  data: DataType
  subSessions: SubSessionsType
}

const initialState: State = {
  data: {},
  subSessions: {},
}

const slice = createSlice({
  name: "formAgentSessions",
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
      const formAgents = action.payload.filter((agent) => agent.type === "form")
      const agentIds = formAgents.map((agent) => agent.id)

      // Remove any agent sessions that don't have a corresponding agent anymore
      Object.keys(state.data).forEach((agentId) => {
        if (!agentIds.includes(agentId)) {
          delete state.data[agentId]
        }
      })

      // Initialize state for any new form agents
      state.data = formAgents.reduce((acc, agent) => {
        acc[agent.id] = state.data[agent.id] || defaultAsyncData
        return acc
      }, {} as DataType)
    })

    builder.addCase(createAgentChatSession.pending, (state, action) => {
      if (action.meta.arg.agentType !== "form") return
      const agentId = action.meta.arg.agentId
      state.data[agentId] = { status: ADS.Loading, value: null, error: null }
    })

    builder
      .addCase(formAgentSessionsThunks.getAll.pending, (state, action) => {
        const agentId = action.meta.arg.agentId
        const sessions = state.data[agentId]
        if (sessions && ADS.isFulfilled(sessions)) return
        state.data[agentId] = { status: ADS.Loading, value: null, error: null }
      })
      .addCase(formAgentSessionsThunks.getAll.fulfilled, (state, action) => {
        const agentId = action.meta.arg.agentId
        state.data[agentId] = { status: ADS.Fulfilled, value: action.payload, error: null }
      })
      .addCase(formAgentSessionsThunks.getAll.rejected, (state, action) => {
        const agentId = action.meta.arg.agentId
        state.data[agentId] = {
          status: ADS.Error,
          value: null,
          error: action.error.message || "Failed to load form sessions",
        }
      })

    builder
      .addCase(formAgentSessionsThunks.listSubSessions.pending, (state, action) => {
        const { agentSessionId } = action.meta.arg
        const current = state.subSessions[agentSessionId]
        if (current && ADS.isFulfilled(current)) return
        state.subSessions[agentSessionId] = { status: ADS.Loading, value: null, error: null }
      })
      .addCase(formAgentSessionsThunks.listSubSessions.fulfilled, (state, action) => {
        const { agentSessionId, subSessions } = action.payload
        state.subSessions[agentSessionId] = {
          status: ADS.Fulfilled,
          value: subSessions,
          error: null,
        }
      })
      .addCase(formAgentSessionsThunks.listSubSessions.rejected, (state, action) => {
        const { agentSessionId } = action.meta.arg
        state.subSessions[agentSessionId] = {
          status: ADS.Error,
          value: null,
          error: action.error.message || "Failed to load form sub-sessions",
        }
      })
  },
})

export type { State as formAgentSessionsState }
export const formAgentSessionsInitialState = initialState
export const formAgentSessionsActions = { ...slice.actions, ...formAgentSessionsThunks }
export const formAgentSessionsSlice = slice
