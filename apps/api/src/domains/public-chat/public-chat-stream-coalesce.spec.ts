import type { StreamEvent, StreamEventPayload } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "@jest/globals"
import { coalesceTurnsIntoOneReply } from "./public-chat.service"

const event = (payload: StreamEventPayload): StreamEvent =>
  ({ data: JSON.stringify(payload) }) as StreamEvent

async function* turns(payloads: StreamEventPayload[]) {
  for (const payload of payloads) yield event(payload)
}

async function collect(payloads: StreamEventPayload[]) {
  const out: StreamEventPayload[] = []
  for await (const streamEvent of coalesceTurnsIntoOneReply(turns(payloads))) {
    out.push(JSON.parse(String(streamEvent.data)) as StreamEventPayload)
  }
  return out
}

describe("coalesceTurnsIntoOneReply", () => {
  it("passes a single reply through unchanged", async () => {
    const out = await collect([
      { type: "start", messageId: "m1" },
      { type: "chunk", content: "Hel", messageId: "m1" },
      { type: "chunk", content: "lo", messageId: "m1" },
      { type: "end", messageId: "m1", fullContent: "Hello" },
    ])
    expect(out).toEqual([
      { type: "start", messageId: "m1" },
      { type: "chunk", content: "Hel", messageId: "m1" },
      { type: "chunk", content: "lo", messageId: "m1" },
      { type: "end", messageId: "m1", fullContent: "Hello" },
    ])
  })

  it("folds two turns into one reply: one start, a blank line between the texts, one end", async () => {
    const out = await collect([
      { type: "start", messageId: "m1" },
      { type: "chunk", content: "I hand you over.", messageId: "m1" },
      { type: "end", messageId: "m1", fullContent: "I hand you over." },
      { type: "start", messageId: "m2" },
      { type: "notify_client", toolName: "fillForm", messageId: "m2" } as StreamEventPayload,
      { type: "chunk", content: "Hello, your name?", messageId: "m2" },
      { type: "end", messageId: "m2", fullContent: "Hello, your name?" },
    ])
    expect(out.filter((payload) => payload.type === "start")).toHaveLength(1)
    expect(out.filter((payload) => payload.type === "end")).toHaveLength(1)
    expect(out.at(-1)).toEqual({
      type: "end",
      messageId: "m1",
      fullContent: "I hand you over.\n\nHello, your name?",
    })
    expect(out.map((payload) => payload.type)).toEqual([
      "start",
      "chunk",
      "chunk",
      "notify_client",
      "chunk",
      "end",
    ])
    // Every chunk is attributed to the reply's single message id.
    expect(
      out
        .filter((payload) => payload.type === "chunk")
        .every((payload) => "messageId" in payload && payload.messageId === "m1"),
    ).toBe(true)
  })

  it("ends the reply on an error and forwards nothing after it", async () => {
    const out = await collect([
      { type: "start", messageId: "m1" },
      { type: "chunk", content: "Hi", messageId: "m1" },
      { type: "error", messageId: "m1", error: "boom" },
      { type: "start", messageId: "m2" },
      { type: "end", messageId: "m2", fullContent: "never" },
    ])
    expect(out.map((payload) => payload.type)).toEqual(["start", "chunk", "error"])
  })
})
