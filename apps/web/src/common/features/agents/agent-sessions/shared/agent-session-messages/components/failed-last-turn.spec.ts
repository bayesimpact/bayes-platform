import { describe, expect, it } from "vitest"
import type { AgentSessionMessage } from "../agent-session-messages.models"
import { findFailedLastTurn } from "./failed-last-turn"

const userMessage: AgentSessionMessage = { id: "user-1", role: "user", content: "Hello" }
const interruptedReply: AgentSessionMessage = {
  id: "assistant-1",
  role: "assistant",
  content: "",
  status: "aborted",
}
const toolRow: AgentSessionMessage = {
  id: "tool-1",
  role: "tool",
  content: "search called",
  status: "completed",
}

describe("findFailedLastTurn", () => {
  it("offers the last turn again when its reply was interrupted", () => {
    expect(findFailedLastTurn([userMessage, interruptedReply])).toEqual({
      userMessage,
      replyIndex: 1,
    })
  })

  it("offers the last turn again when its reply failed", () => {
    const failedReply: AgentSessionMessage = { ...interruptedReply, status: "error" }
    expect(findFailedLastTurn([userMessage, failedReply])).toEqual({
      userMessage,
      replyIndex: 1,
    })
  })

  it("looks past the tool rows a turn persisted while it ran", () => {
    // After a refresh, tool rows written during the turn sort after the reply. The Retry
    // affordance still belongs on the reply, and the turn is still the one to resend.
    expect(findFailedLastTurn([userMessage, interruptedReply, toolRow, toolRow])).toEqual({
      userMessage,
      replyIndex: 1,
    })
  })

  it("offers nothing when the last reply settled", () => {
    const completedReply: AgentSessionMessage = {
      ...interruptedReply,
      content: "Hi!",
      status: "completed",
    }
    expect(findFailedLastTurn([userMessage, completedReply, toolRow])).toBeUndefined()
  })

  it("offers nothing for an older failure", () => {
    const laterUserMessage: AgentSessionMessage = { id: "user-2", role: "user", content: "Again" }
    const completedReply: AgentSessionMessage = {
      id: "assistant-2",
      role: "assistant",
      content: "Hi!",
      status: "completed",
    }
    expect(
      findFailedLastTurn([userMessage, interruptedReply, laterUserMessage, completedReply]),
    ).toBeUndefined()
  })

  it("offers nothing while the reply is still being written", () => {
    const streamingReply: AgentSessionMessage = { ...interruptedReply, status: "streaming" }
    expect(findFailedLastTurn([userMessage, streamingReply])).toBeUndefined()
  })
})
