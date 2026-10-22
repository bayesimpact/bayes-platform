import { describe, expect, it } from "vitest"
import {
  applyReplyEvent,
  type ChatMessage,
  failStreamingReplies,
  findRetryableMessage,
  type ReplyCursor,
  setAttachmentDocument,
  startTurn,
  toChatMessages,
} from "./chat-messages"

const now = 1_000_000

function startedTurn() {
  const messages = startTurn(
    [],
    { content: "Compare the plans", attachment: null },
    { userMessageId: "user", replyId: "reply" },
    now,
  )
  const cursor: ReplyCursor = { messageId: "reply", hasStarted: false }
  return { messages, cursor }
}

const contentOf = (messages: ChatMessage[]) =>
  messages.map((message) => [message.role, message.content, message.status])

describe("toChatMessages", () => {
  it("leaves out tool results and reads the tools each reply called", () => {
    const id = () => crypto.randomUUID()
    const messages = toChatMessages([
      { id: id(), role: "user", content: "Hello" },
      { id: id(), role: "tool", content: "{}" },
      {
        id: id(),
        role: "assistant",
        content: "Hi",
        status: "completed",
        toolCalls: [{ id: "call", name: "lookup_knowledge_base" }],
      },
    ])

    expect(messages.map((message) => [message.role, message.status, message.toolNames])).toEqual([
      ["user", "completed", []],
      ["assistant", "completed", ["lookup_knowledge_base"]],
    ])
  })
})

describe("applyReplyEvent", () => {
  it("renames the placeholder on start, then writes the chunks, the steps and the end", () => {
    const messageId = crypto.randomUUID()
    let { messages, cursor } = startedTurn()
    for (const event of [
      { type: "start", messageId },
      { type: "notify_client", toolName: "lookup_knowledge_base" },
      { type: "chunk", messageId, content: "The Pro" },
      { type: "chunk", messageId, content: " plan" },
    ] as const) {
      ;({ messages, cursor } = applyReplyEvent(messages, event, cursor, now))
    }

    expect(messages[1]).toMatchObject({
      id: messageId,
      content: "The Pro plan",
      status: "streaming",
      toolNames: ["lookup_knowledge_base"],
    })

    ;({ messages } = applyReplyEvent(
      messages,
      { type: "end", messageId, fullContent: "The Pro plan fits." },
      cursor,
      now,
    ))
    expect(contentOf(messages)).toEqual([
      ["user", "Compare the plans", "completed"],
      ["assistant", "The Pro plan fits.", "completed"],
    ])
  })

  it("opens a message of its own for a sub-agent that takes over", () => {
    const firstId = crypto.randomUUID()
    const secondId = crypto.randomUUID()
    let { messages, cursor } = startedTurn()
    for (const event of [
      { type: "start", messageId: firstId },
      { type: "end", messageId: firstId, fullContent: "Let me hand you over." },
      { type: "start", messageId: secondId },
      { type: "chunk", messageId: secondId, content: "Hello, I take it from here." },
    ] as const) {
      ;({ messages, cursor } = applyReplyEvent(messages, event, cursor, now))
    }

    expect(contentOf(messages)).toEqual([
      ["user", "Compare the plans", "completed"],
      ["assistant", "Let me hand you over.", "completed"],
      ["assistant", "Hello, I take it from here.", "streaming"],
    ])
  })

  it("fails the current reply with the server's reason", () => {
    const { messages, cursor } = startedTurn()

    const next = applyReplyEvent(messages, { type: "error", error: "Forbidden" }, cursor, now)

    expect(next.messages[1]).toMatchObject({ content: "Forbidden", status: "error" })
  })
})

describe("failStreamingReplies", () => {
  it("fails the replies still streaming, and only them", () => {
    const { messages } = startedTurn()

    expect(failStreamingReplies(messages, "ended").map((message) => message.failure)).toEqual([
      null,
      "ended",
    ])
  })
})

describe("findRetryableMessage", () => {
  it("offers to send again the message a failed last reply answered", () => {
    const { messages } = startedTurn()

    expect(findRetryableMessage(failStreamingReplies(messages, "ended"), now)).toEqual({
      content: "Compare the plans",
      attachment: null,
    })
  })

  it("sends again a file whose upload failed, and an uploaded one by its document", () => {
    const file = new File(["%PDF-1.7"], "invoice.pdf", { type: "application/pdf" })
    const messages = startTurn(
      [],
      { content: "Read this invoice", attachment: { file } },
      { userMessageId: "user", replyId: "reply" },
      now,
    )

    expect(findRetryableMessage(failStreamingReplies(messages, "upload"), now)).toEqual({
      content: "Read this invoice",
      attachment: { file },
    })
    const documentId = crypto.randomUUID()
    const uploaded = setAttachmentDocument(messages, "user", documentId)
    expect(findRetryableMessage(failStreamingReplies(uploaded, "ended"), now)).toEqual({
      content: "Read this invoice",
      attachment: { documentId },
    })
  })

  it("offers nothing while a reply is written or after it ended", () => {
    const { messages } = startedTurn()

    expect(findRetryableMessage(messages, now)).toBeNull()
    expect(findRetryableMessage([], now)).toBeNull()
  })

  it("offers to send again a reply the server never finished", () => {
    const { messages } = startedTurn()
    const thirtyOneMinutesLater = now + 31 * 60 * 1000

    expect(findRetryableMessage(messages, thirtyOneMinutesLater)?.content).toBe("Compare the plans")
  })
})
