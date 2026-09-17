import type { LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { createUnfinishedToolCallTracker } from "@/external/llm/unfinished-tool-calls"

const finish: LanguageModelV3StreamPart = {
  type: "finish",
  finishReason: { unified: "tool-calls", raw: "tool_calls" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
    raw: undefined,
  },
}

describe("createUnfinishedToolCallTracker", () => {
  it("emits the tool call the provider dropped, with its raw arguments", () => {
    const tracker = createUnfinishedToolCallTracker()
    tracker.before({ type: "tool-input-start", id: "call-1", toolName: "fillForm" })
    tracker.before({ type: "tool-input-delta", id: "call-1", delta: '{"a": "x"' })
    tracker.before({ type: "tool-input-delta", id: "call-1", delta: 'x", "b": 1}' })

    expect(tracker.before(finish)).toEqual([
      { type: "tool-input-end", id: "call-1" },
      {
        type: "tool-call",
        toolCallId: "call-1",
        toolName: "fillForm",
        input: '{"a": "x"x", "b": 1}',
      },
    ])
    expect(tracker.emitted()).toEqual(["fillForm"])
  })

  it("adds nothing when the provider emitted the tool call itself", () => {
    const tracker = createUnfinishedToolCallTracker()
    tracker.before({ type: "tool-input-start", id: "call-1", toolName: "fillForm" })
    tracker.before({ type: "tool-input-delta", id: "call-1", delta: "{}" })
    tracker.before({ type: "tool-input-end", id: "call-1" })
    tracker.before({ type: "tool-call", toolCallId: "call-1", toolName: "fillForm", input: "{}" })

    expect(tracker.before(finish)).toEqual([])
    expect(tracker.emitted()).toEqual([])
  })

  it("ignores text and streams without tool input", () => {
    const tracker = createUnfinishedToolCallTracker()
    tracker.before({ type: "text-start", id: "t" })
    tracker.before({ type: "text-delta", id: "t", delta: "Hello" })
    tracker.before({ type: "text-end", id: "t" })

    expect(tracker.before(finish)).toEqual([])
  })
})
