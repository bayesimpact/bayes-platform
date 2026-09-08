import { describe, expect, it, vi } from "vitest"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import type { AgentSessionMessage } from "./agent-session-messages.models"
import { selectStreaming } from "./agent-session-messages.selectors"
import {
  agentSessionMessagesActions,
  agentSessionMessagesInitialState,
  agentSessionMessagesSlice,
} from "./agent-session-messages.slice"
import { getMessage, listMessages } from "./agent-session-messages.thunks"

// The thunks module reaches the Auth0 client and `window.location` transitively; neither exists
// under vitest's node environment, and the reducer under test needs only the action creators.
vi.mock("@/studio/routes/helpers", () => ({ isStudioInterface: vi.fn() }))
vi.mock("./external/agent-session-messages-streaming", () => ({ streamChatResponse: vi.fn() }))

const reducer = agentSessionMessagesSlice.reducer

/** Whether the composer is locked for this slice state. */
const isStreaming = (state: ReturnType<typeof reducer>) =>
  selectStreaming({ agentSessionMessages: state } as unknown as RootState)

const userMessage: AgentSessionMessage = { id: "user-1", role: "user", content: "Hello" }
const streamingReply: AgentSessionMessage = {
  id: "assistant-1",
  role: "assistant",
  content: "",
  status: "streaming",
}
const completedReply: AgentSessionMessage = {
  id: "assistant-1",
  role: "assistant",
  content: "Hi!",
  status: "completed",
}

describe("agentSessionMessages slice", () => {
  describe("listMessages.fulfilled", () => {
    it("treats a reply that is still streaming server-side as streaming", () => {
      // After a page refresh the persisted reply can still be "streaming": the server keeps
      // writing it. The composer must stay locked exactly as it was before the refresh.
      const state = reducer(
        agentSessionMessagesInitialState,
        listMessages.fulfilled([userMessage, streamingReply], "request-1", "session-1"),
      )

      expect(isStreaming(state)).toBe(true)
    })

    it("ignores a list that lands while a reply is being written", () => {
      // A list fetched before the turn was persisted would drop the optimistic turn and unlock
      // the composer while the SSE stream still runs. The stream settles the thread itself.
      const streamingState = reducer(
        reducer(
          agentSessionMessagesInitialState,
          listMessages.fulfilled([userMessage], "request-1", "session-1"),
        ),
        agentSessionMessagesActions.startStreaming({
          userMessage: { id: "user-2", role: "user", content: "Again" },
          assistantMessageId: "optimistic-2",
        }),
      )

      const state = reducer(
        streamingState,
        listMessages.fulfilled([userMessage], "request-2", "session-1"),
      )

      expect(state).toBe(streamingState)
      expect(isStreaming(state)).toBe(true)
    })

    it("applies a list that shows the reply being written here as settled", () => {
      // Once the stream ends the thread is reloaded for the persisted turn (tool results, MCP
      // markup). A list carrying the reply's outcome is the truth and must not be set aside.
      const streamingState = reducer(
        agentSessionMessagesInitialState,
        listMessages.fulfilled([userMessage, streamingReply], "request-1", "session-1"),
      )

      const state = reducer(
        streamingState,
        listMessages.fulfilled([userMessage, completedReply], "request-2", "session-1"),
      )

      expect(ADS.isFulfilled(state.data) && state.data.value).toEqual([userMessage, completedReply])
      expect(isStreaming(state)).toBe(false)
    })

    it("keeps locally streamed content when the list still reports the reply streaming", () => {
      // A list that lands mid-stream knows the turn but not its content, which the server writes
      // at completion. The rest of the list is applied; the reply keeps the chunks received.
      const withChunk = reducer(
        reducer(
          agentSessionMessagesInitialState,
          listMessages.fulfilled([userMessage, streamingReply], "request-1", "session-1"),
        ),
        agentSessionMessagesActions.appendAssistantChunk({
          messageId: streamingReply.id,
          chunk: "Hel",
        }),
      )
      const toolRow: AgentSessionMessage = {
        id: "tool-1",
        role: "tool",
        content: "search called",
        status: "completed",
      }

      const state = reducer(
        withChunk,
        listMessages.fulfilled([userMessage, streamingReply, toolRow], "request-2", "session-1"),
      )

      expect(ADS.isFulfilled(state.data) && state.data.value).toEqual([
        userMessage,
        { ...streamingReply, content: "Hel" },
        toolRow,
      ])
      expect(isStreaming(state)).toBe(true)
    })

    it("does not stream when every reply has settled", () => {
      const state = reducer(
        agentSessionMessagesInitialState,
        listMessages.fulfilled([userMessage, completedReply], "request-1", "session-1"),
      )

      expect(isStreaming(state)).toBe(false)
    })
  })

  describe("getMessage.fulfilled", () => {
    it("stops streaming once the polled reply has settled", () => {
      const streamingState = reducer(
        agentSessionMessagesInitialState,
        listMessages.fulfilled([userMessage, streamingReply], "request-1", "session-1"),
      )

      const state = reducer(
        streamingState,
        getMessage.fulfilled(completedReply, "request-2", completedReply.id),
      )

      expect(isStreaming(state)).toBe(false)
      expect(ADS.isFulfilled(state.data) && state.data.value[1]).toEqual(completedReply)
    })

    it("keeps streaming while the polled reply is still being written", () => {
      const streamingState = reducer(
        agentSessionMessagesInitialState,
        listMessages.fulfilled([userMessage, streamingReply], "request-1", "session-1"),
      )

      const state = reducer(
        streamingState,
        getMessage.fulfilled(streamingReply, "request-2", streamingReply.id),
      )

      expect(isStreaming(state)).toBe(true)
    })

    it("keeps locally streamed content when the snapshot is still streaming", () => {
      // The server persists content only at completion, so a mid-stream snapshot is empty.
      // Applying it would wipe the chunks the live stream has already delivered.
      const withChunk = reducer(
        reducer(
          agentSessionMessagesInitialState,
          listMessages.fulfilled([userMessage, streamingReply], "request-1", "session-1"),
        ),
        agentSessionMessagesActions.appendAssistantChunk({
          messageId: streamingReply.id,
          chunk: "Hel",
        }),
      )

      const state = reducer(
        withChunk,
        getMessage.fulfilled(streamingReply, "request-2", streamingReply.id),
      )

      expect(ADS.isFulfilled(state.data) && state.data.value[1]?.content).toBe("Hel")
      expect(isStreaming(state)).toBe(true)
    })

    it("keeps a completed reply when a late snapshot still says streaming", () => {
      // The read after `end` can be served before the completion is visible.
      const completedState = reducer(
        agentSessionMessagesInitialState,
        listMessages.fulfilled([userMessage, completedReply], "request-1", "session-1"),
      )

      const state = reducer(
        completedState,
        getMessage.fulfilled(streamingReply, "request-2", streamingReply.id),
      )

      expect(ADS.isFulfilled(state.data) && state.data.value[1]).toEqual(completedReply)
      expect(isStreaming(state)).toBe(false)
    })
  })
})
