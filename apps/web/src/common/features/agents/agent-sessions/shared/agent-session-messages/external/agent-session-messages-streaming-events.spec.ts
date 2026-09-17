import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  parseSSEEvent,
  processSSEChunk,
  type StreamContext,
  type StreamEventHandler,
} from "./agent-session-messages-streaming-events"

const buildHandlers = () =>
  ({
    onStart: vi.fn(),
    onChunk: vi.fn(),
    onNotifyClient: vi.fn(),
    onEnd: vi.fn(),
    onError: vi.fn(),
  }) satisfies StreamEventHandler

const buildContext = (): StreamContext => ({ messageId: "optimistic-1" })

/** Frames the app emits itself: a lone `data:` line holding the JSON payload, no `event:` line. */
const jsonFrame = (payload: Record<string, unknown>) => `data: ${JSON.stringify(payload)}\n\n`

/**
 * Frame Nest writes when the SSE handler throws, byte for byte: an `event: error` line, an `id:`
 * line, and the raw error message as data. Not JSON.
 */
const nestErrorFrame = (message: string) => `\nevent: error\nid: 1\ndata: ${message}\n\n`

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("parseSSEEvent", () => {
  it("turns a Nest error frame into an error event attributed to the streamed message", () => {
    const event = parseSSEEvent("\nevent: error\nid: 1\ndata: Invalid query format", buildContext())

    expect(event).toEqual({
      type: "error",
      messageId: "optimistic-1",
      error: "Invalid query format",
    })
  })

  it("turns an error frame with no data line into an error event with the fallback message", () => {
    // Nest omits the `data:` line entirely when the thrown error's message is falsy:
    // `data += message.data ? toDataString(message.data) : ''` in its sse-stream.
    const event = parseSSEEvent("\nevent: error\nid: 1", buildContext())

    expect(event).toEqual({
      type: "error",
      messageId: "optimistic-1",
      error: "The agent stopped responding",
    })
  })

  it("reads a JSON payload frame", () => {
    const event = parseSSEEvent('data: {"type":"chunk","content":"Hi","messageId":"m1"}', {
      messageId: "optimistic-1",
    })

    expect(event).toEqual({ type: "chunk", content: "Hi", messageId: "m1" })
  })

  it("keeps logging a malformed frame that is not an error frame", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(parseSSEEvent("data: not json", buildContext())).toBeNull()
    expect(consoleError).toHaveBeenCalled()
  })

  it("returns null for a frame with no data line", () => {
    expect(parseSSEEvent(": keep-alive", buildContext())).toBeNull()
  })
})

describe("processSSEChunk", () => {
  it("surfaces a rejected request through onError instead of dropping the frame", () => {
    // The three playground rejections (unknown revision, archived revision, revision on a live
    // session) all come back like this. Dropping the frame left the assistant bubble streaming
    // for good, which also blocked every later send.
    const handlers = buildHandlers()

    const { done } = processSSEChunk(
      nestErrorFrame("Version 99 not found for agent agent-1"),
      handlers,
      buildContext(),
    )

    expect(done).toBe(true)
    expect(handlers.onError).toHaveBeenCalledWith({
      type: "error",
      messageId: "optimistic-1",
      error: "Version 99 not found for agent agent-1",
    })
  })

  it("attributes an error frame to the persisted message once the stream named it", () => {
    const handlers = buildHandlers()
    const context = buildContext()

    processSSEChunk(jsonFrame({ type: "start", messageId: "persisted-1" }), handlers, context)
    processSSEChunk(nestErrorFrame("Model call failed"), handlers, context)

    expect(handlers.onError).toHaveBeenCalledWith({
      type: "error",
      messageId: "persisted-1",
      error: "Model call failed",
    })
  })

  it("dispatches the app's own events and keeps reading after end", () => {
    const handlers = buildHandlers()
    const chunk = [
      jsonFrame({ type: "start", messageId: "m1" }),
      jsonFrame({ type: "chunk", content: "Hello", messageId: "m1" }),
      jsonFrame({ type: "end", messageId: "m1", fullContent: "Hello" }),
    ].join("")

    const { done } = processSSEChunk(chunk, handlers, buildContext())

    expect(done).toBe(false)
    expect(handlers.onStart).toHaveBeenCalledWith({ type: "start", messageId: "m1" })
    expect(handlers.onChunk).toHaveBeenCalledTimes(1)
    expect(handlers.onEnd).toHaveBeenCalledWith({
      type: "end",
      messageId: "m1",
      fullContent: "Hello",
    })
  })

  it("dispatches the next agent's reply that follows a hand-over in the same response", () => {
    // After a hand-over the response carries two replies: the hand-over sentence, then the
    // sub-agent's first reply. Stopping on the first `end` left the second one to a page reload.
    const handlers = buildHandlers()
    const chunk = [
      jsonFrame({ type: "start", messageId: "m1" }),
      jsonFrame({ type: "end", messageId: "m1", fullContent: "I hand you over." }),
      jsonFrame({ type: "start", messageId: "m2" }),
      jsonFrame({ type: "chunk", content: "Hello!", messageId: "m2" }),
      jsonFrame({ type: "end", messageId: "m2", fullContent: "Hello!" }),
    ].join("")

    const { done } = processSSEChunk(chunk, handlers, buildContext())

    expect(done).toBe(false)
    expect(handlers.onStart).toHaveBeenCalledTimes(2)
    expect(handlers.onStart).toHaveBeenLastCalledWith({ type: "start", messageId: "m2" })
    expect(handlers.onChunk).toHaveBeenCalledWith({
      type: "chunk",
      content: "Hello!",
      messageId: "m2",
    })
    expect(handlers.onEnd).toHaveBeenCalledTimes(2)
    expect(handlers.onEnd).toHaveBeenLastCalledWith({
      type: "end",
      messageId: "m2",
      fullContent: "Hello!",
    })
  })

  it("keeps the trailing partial frame for the next read", () => {
    const handlers = buildHandlers()

    const { remaining, done } = processSSEChunk(
      `${jsonFrame({ type: "chunk", content: "Hel", messageId: "m1" })}data: {"type":"chun`,
      handlers,
      buildContext(),
    )

    expect(done).toBe(false)
    expect(remaining).toBe('data: {"type":"chun')
    expect(handlers.onChunk).toHaveBeenCalledTimes(1)
  })
})
