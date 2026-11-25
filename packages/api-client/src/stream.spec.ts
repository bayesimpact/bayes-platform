import { describe, expect, it } from "vitest"
import { parseFrame, readServerSentEvents } from "./stream"

/** A body that sends the given pieces of text one after the other. */
function bodyOf(pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece))
      controller.close()
    },
  })
}

async function readAll(pieces: string[]) {
  const events = []
  for await (const event of readServerSentEvents(bodyOf(pieces))) events.push(event)
  return events
}

describe("readServerSentEvents", () => {
  it("reads frames split anywhere across chunks, and skips Nest's id lines", async () => {
    const events = await readAll([
      'id: 1\ndata: {"type":"st',
      'art"}\n\nid: 2\ndata: {"type":"end"}\n',
      "\n",
    ])

    expect(events).toEqual([
      { event: null, data: '{"type":"start"}' },
      { event: null, data: '{"type":"end"}' },
    ])
  })

  it("reads the error frames Nest writes, with or without data", async () => {
    const events = await readAll(["event: error\ndata: Forbidden\n\nevent: error\n\n"])

    expect(events).toEqual([
      { event: "error", data: "Forbidden" },
      { event: "error", data: "" },
    ])
  })

  it("reads CRLF line ends, even when a chunk ends between the CR and the LF", async () => {
    const events = await readAll([
      "event: message\r",
      '\ndata: {"type":"start"}\r\n\r',
      '\ndata: {"type":"end"}\r\n\r\n',
    ])

    expect(events).toEqual([
      { event: "message", data: '{"type":"start"}' },
      { event: null, data: '{"type":"end"}' },
    ])
  })

  it("flushes the decoder at the end, so a broken last character still shows", async () => {
    const bytes = new TextEncoder().encode("data: café")
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // The body ends one byte into the two bytes of "é".
        controller.enqueue(bytes.slice(0, -1))
        controller.close()
      },
    })
    const events = []
    for await (const event of readServerSentEvents(body)) events.push(event)

    expect(events).toEqual([{ event: null, data: "caf\uFFFD" }])
  })

  it("reads a last frame the server closed without a blank line", async () => {
    expect(await readAll(['data: {"type":"end"}'])).toEqual([
      { event: null, data: '{"type":"end"}' },
    ])
  })
})

describe("parseFrame", () => {
  it("joins data lines, keeps the spaces after the first one and ignores comments", () => {
    expect(parseFrame(": keep-alive\ndata:  two spaces\ndata: line")).toEqual({
      event: null,
      data: " two spaces\nline",
    })
  })

  it("drops a frame with nothing to read", () => {
    expect(parseFrame("id: 3\n: comment")).toBeNull()
  })
})
