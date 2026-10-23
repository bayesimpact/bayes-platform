import { combineReducers, configureStore, type Reducer } from "@reduxjs/toolkit"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ADS } from "@/common/store/async-data-status"
import type { RootState } from "@/common/store/types"
import type { Services } from "@/di/services"
import { conversationAgentSessionFactory } from "../../agent-session.factory"
import {
  conversationAgentSessionsActions,
  conversationAgentSessionsSlice,
} from "../../conversation/conversation-agent-sessions.slice"
import { baseAgentSessionsMiddleware } from "./base-agent-sessions.middleware"
import { createAgentChatSession } from "./base-agent-sessions.thunks"

// The thunks module reaches `window.location` transitively; it does not exist under vitest's node
// environment.
vi.mock("@/studio/routes/helpers", () => ({ isStudioInterface: vi.fn().mockReturnValue(false) }))

const agentId = "agent-1"
const currentIds = { organizationId: "org-1", projectId: "project-1", agentId }
const session = conversationAgentSessionFactory.build({ agentId })

/** A store holding only the slices the listener reads, with the real sessions reducer. */
function buildStore({ createOne }: { createOne: ReturnType<typeof vi.fn> }) {
  const getAll = vi.fn().mockResolvedValue([session])
  const services = { conversationAgentSessions: { getAll, createOne } } as unknown as Services
  const store = configureStore({
    reducer: combineReducers({
      conversationAgentSessions: conversationAgentSessionsSlice.reducer,
      currentIds: (state = currentIds) => state,
    }) as unknown as Reducer<RootState>,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: { services } } }).prepend(
        baseAgentSessionsMiddleware.listenerMiddleware.middleware,
      ),
  })
  baseAgentSessionsMiddleware.registerListeners()
  return store
}

afterEach(() => {
  baseAgentSessionsMiddleware.listenerMiddleware.clearListeners()
})

describe("creating a conversation session", () => {
  it("brings the session list back when the creation fails", async () => {
    const createOne = vi.fn().mockRejectedValue(new Error("MISSING_PROMPT_VARIABLES"))
    const store = buildStore({ createOne })
    await store.dispatch(conversationAgentSessionsActions.getAll({ agentId }))

    await store.dispatch(createAgentChatSession({ agentType: "conversation", agentId }))

    await vi.waitFor(() =>
      expect(store.getState().conversationAgentSessions.data[agentId]).toEqual({
        status: ADS.Fulfilled,
        value: [session],
        error: null,
      }),
    )
  })
})
