import type { PublicChatV2 } from "@caseai-connect/api-contracts"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, streamReply } from "./public-chat-api"

const sseResponse = (events: PublicChatV2.PublicStreamEventPayload[]) => {
  const text = events
    .map((event, index) => `id: ${index + 1}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("")
  return new Response(new TextEncoder().encode(`\n${text}`), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  })
}

const collect = async (stream: AsyncGenerator<PublicChatV2.PublicStreamEventPayload>) => {
  const events: PublicChatV2.PublicStreamEventPayload[] = []
  for await (const event of stream) events.push(event)
  return events
}

describe("streamReply", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sends the message in a POST body and never in the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([]))
    vi.stubGlobal("fetch", fetchMock)

    const message = "A long message with private details"
    await collect(streamReply("embed-token", "session-id", "session-token", message))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/public\/v2\/agents\/embed-token\/sessions\/session-id\/stream$/)
    expect(url).not.toContain("?")
    expect(url).not.toContain(encodeURIComponent(message))
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Session-Token": "session-token",
      Accept: "text/event-stream",
    })
    expect(JSON.parse(String(init.body))).toEqual({ payload: { content: message } })
  })

  it("yields each data event of the stream in order", async () => {
    const events: PublicChatV2.PublicStreamEventPayload[] = [
      { type: "start", messageId: "message-1" },
      { type: "chunk", content: "Hello", messageId: "message-1" },
      { type: "end", messageId: "message-1", fullContent: "Hello" },
    ]
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(events)))

    expect(await collect(streamReply("embed-token", "session-id", "session-token", "Hi"))).toEqual(
      events,
    )
  })

  it("throws an ApiError with the status when the stream does not start", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: "SESSION_EXPIRED" }), { status: 410 }),
        ),
    )

    const error = await collect(
      streamReply("embed-token", "session-id", "session-token", "Hi"),
    ).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(410)
  })
})
