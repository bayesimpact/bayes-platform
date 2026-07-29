import { describe, expect, it } from "vitest"
import { agentSessionMessageFactory } from "@/common/features/agents/agent-sessions/agent-session.factory"
import type { AgentSessionMessage } from "../agent-session-messages.models"
import { buildRevisionMarkers } from "./agent-session-messages-revision-markers"

const revisionOne = { revision: 1, revisionName: "Initial version", isDraft: false }
const revisionTwo = { revision: 2, revisionName: "Draft tone", isDraft: true }

const assistantMessage = (overrides: Partial<AgentSessionMessage> = {}): AgentSessionMessage =>
  agentSessionMessageFactory.build({ role: "assistant", ...overrides })

const userMessage = (overrides: Partial<AgentSessionMessage> = {}): AgentSessionMessage =>
  agentSessionMessageFactory.build({ role: "user", ...overrides })

describe("buildRevisionMarkers", () => {
  it("marks the first assistant turn when every turn ran on the same revision", () => {
    const messages = [
      userMessage({ id: "message-1" }),
      assistantMessage({ id: "message-2", agentSettings: revisionOne }),
      userMessage({ id: "message-3" }),
      assistantMessage({ id: "message-4", agentSettings: revisionOne }),
    ]

    const markers = buildRevisionMarkers(messages)

    expect(markers.size).toBe(1)
    expect(markers.get("message-2")).toEqual(revisionOne)
  })

  it("marks the assistant turn where the revision switches mid-conversation", () => {
    const messages = [
      userMessage({ id: "message-1" }),
      assistantMessage({ id: "message-2", agentSettings: revisionOne }),
      userMessage({ id: "message-3" }),
      assistantMessage({ id: "message-4", agentSettings: revisionTwo }),
    ]

    const markers = buildRevisionMarkers(messages)

    expect(markers.size).toBe(2)
    expect(markers.get("message-2")).toEqual(revisionOne)
    expect(markers.get("message-4")).toEqual(revisionTwo)
  })

  it("produces no markers when no message carries agentSettings", () => {
    const messages = [
      userMessage({ id: "message-1" }),
      assistantMessage({ id: "message-2", agentSettings: undefined }),
      assistantMessage({ id: "message-3", agentSettings: undefined }),
    ]

    const markers = buildRevisionMarkers(messages)

    expect(markers.size).toBe(0)
  })

  it("never marks a user turn, even when interleaved between assistant turns", () => {
    const messages = [
      assistantMessage({ id: "message-1", agentSettings: revisionOne }),
      userMessage({ id: "message-2", agentSettings: revisionOne }),
      assistantMessage({ id: "message-3", agentSettings: revisionOne }),
    ]

    const markers = buildRevisionMarkers(messages)

    expect(markers.has("message-2")).toBe(false)
    expect(markers.size).toBe(1)
    expect(markers.get("message-1")).toEqual(revisionOne)
  })

  it("marks a revisioned turn that follows one with no attribution yet", () => {
    const messages = [
      assistantMessage({ id: "message-1", agentSettings: undefined }),
      userMessage({ id: "message-2" }),
      assistantMessage({ id: "message-3", agentSettings: revisionOne }),
    ]

    const markers = buildRevisionMarkers(messages)

    expect(markers.size).toBe(1)
    expect(markers.get("message-3")).toEqual(revisionOne)
  })
})
