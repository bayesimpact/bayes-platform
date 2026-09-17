import { beforeEach, describe, expect, it, vi } from "vitest"
import { streamChatResponse } from "./agent-session-messages-streaming"
import type { StreamEventHandler } from "./agent-session-messages-streaming-events"

// The real client needs `window`, which vitest's node environment does not provide. Only the
// token fetch is replaced: the SSE reading and parsing under test stay real.
vi.mock("@/external/auth0Client", () => ({ getAccessToken: vi.fn().mockResolvedValue("token") }))

const params = {
  organizationId: "org-1",
  projectId: "project-1",
  agentId: "agent-1",
  agentSessionId: "session-1",
  content: "Hello",
  assistantMessageId: "optimistic-1",
}

const buildHandlers = () =>
  ({
    onStart: vi.fn(),
    onChunk: vi.fn(),
    onNotifyClient: vi.fn(),
    onEnd: vi.fn(),
    onError: vi.fn(),
  }) satisfies StreamEventHandler

const respondWith = (body: string) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    ),
  )
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe("streamChatResponse", () => {
  it("reports a rejected request through onError", async () => {
    // Byte for byte what the API answers when the playground names a revision it may not run:
    // HTTP 200 with a bare, unparseable error frame. Dropping it left the message streaming for
    // good, with no way out but a page reload.
    respondWith("\nevent: error\nid: 1\ndata: Invalid query format\n\n")
    const handlers = buildHandlers()

    await streamChatResponse({ ...params, handlers })

    expect(handlers.onError).toHaveBeenCalledWith({
      type: "error",
      messageId: "optimistic-1",
      error: "Invalid query format",
    })
  })

  it("reports an error frame carrying no data line through onError", async () => {
    // What the API answers when the SSE handler throws an error whose message is falsy: Nest
    // omits the `data:` line entirely. The frame must still terminate the stream as an error,
    // with the fallback message standing in for the missing one.
    respondWith("\nevent: error\nid: 1\n\n")
    const handlers = buildHandlers()

    await streamChatResponse({ ...params, handlers })

    expect(handlers.onError).toHaveBeenCalledWith({
      type: "error",
      messageId: "optimistic-1",
      error: "The agent stopped responding",
    })
  })

  it("reads a full answer from the event stream", async () => {
    respondWith(
      [
        '\ndata: {"type":"start","messageId":"persisted-1"}\n\n',
        'data: {"type":"chunk","content":"Hello","messageId":"persisted-1"}\n\n',
        'data: {"type":"end","messageId":"persisted-1","fullContent":"Hello"}\n\n',
      ].join(""),
    )
    const handlers = buildHandlers()

    await streamChatResponse({ ...params, handlers })

    expect(handlers.onStart).toHaveBeenCalledWith({ type: "start", messageId: "persisted-1" })
    expect(handlers.onChunk).toHaveBeenCalledWith({
      type: "chunk",
      content: "Hello",
      messageId: "persisted-1",
    })
    expect(handlers.onEnd).toHaveBeenCalledWith({
      type: "end",
      messageId: "persisted-1",
      fullContent: "Hello",
    })
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it("reads every reply of the response, not only the first", async () => {
    respondWith(
      [
        'data: {"type":"start","messageId":"persisted-1"}\n\n',
        'data: {"type":"end","messageId":"persisted-1","fullContent":"I hand you over."}\n\n',
        'data: {"type":"start","messageId":"persisted-2"}\n\n',
        'data: {"type":"chunk","content":"Hello!","messageId":"persisted-2"}\n\n',
        'data: {"type":"end","messageId":"persisted-2","fullContent":"Hello!"}\n\n',
      ].join(""),
    )
    const handlers = buildHandlers()

    await streamChatResponse({ ...params, handlers })

    expect(handlers.onStart).toHaveBeenCalledTimes(2)
    expect(handlers.onEnd).toHaveBeenLastCalledWith({
      type: "end",
      messageId: "persisted-2",
      fullContent: "Hello!",
    })
    expect(handlers.onError).not.toHaveBeenCalled()
  })

  it("carries the chosen settings revision in the query", async () => {
    respondWith('data: {"type":"end","messageId":"persisted-1","fullContent":""}\n\n')

    await streamChatResponse({ ...params, agentSettingsRevision: 3, handlers: buildHandlers() })

    const url = vi.mocked(fetch).mock.calls[0]?.[0]
    expect(decodeURIComponent(String(url))).toContain('"agentSettingsRevision":3')
  })
})
