import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { type Annotation, QUOTABLE_ATTRIBUTE } from "../annotation"
import type { ChatMessage } from "../chat-messages"
import { createChatWrapper } from "../test/chat-wrapper"
import { mockStreamRoute } from "../test/mock-route"
import { server } from "../test/server"
import { testRoutes } from "../test/test-chat"
import { useConversationSend } from "./use-conversation-send"

const conversation = {
  organizationId: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  agentId: crypto.randomUUID(),
  agentSessionId: crypto.randomUUID(),
}

/** What the stream route received: the content of each message sent, and its attachment. */
function recordSentMessages() {
  const sent: { content: string; attachmentDocumentId: string | undefined }[] = []
  server.use(
    mockStreamRoute(testRoutes.conversation.streamReply, ({ payload }) => {
      sent.push({ content: payload.content, attachmentDocumentId: payload.attachmentDocumentId })
      return []
    }),
  )
  return sent
}

const replyId = crypto.randomUUID()
const reply: ChatMessage = {
  id: replyId,
  role: "assistant",
  content: "To check:\n\n- [ ] The tool accepts team",
  status: "completed",
  toolNames: [],
  toolResults: [],
  createdAt: null,
  failure: null,
  sources: [],
  resources: [],
  attachment: null,
  mcpApps: [],
  followUpQuestions: [],
}

/** An annotation of the reply's text, as the person left it. */
function annotate(): Annotation {
  const layer = document.createElement("div")
  const text = document.createElement("p")
  text.setAttribute(QUOTABLE_ATTRIBUTE, replyId)
  text.textContent = "The tool accepts team"
  layer.append(text)
  document.body.append(layer)
  const range = document.createRange()
  range.selectNodeContents(text)
  return {
    id: crypto.randomUUID(),
    passage: "The tool accepts team",
    note: "Check the name",
    range,
    layer,
    reply: text,
    occurrence: 1,
  }
}

describe("useConversationSend", () => {
  it("sends the message with its annotations and ticked tasks, then clears them", async () => {
    const sent = recordSentMessages()
    const { wrapper } = createChatWrapper()
    const { result } = renderHook(() => useConversationSend(conversation, [reply]), { wrapper })
    act(() => {
      result.current.saveAnnotation(annotate())
      result.current.taskChecks.toggle({
        replyId,
        item: 1,
        isChecked: true,
        text: "The tool accepts team",
      })
    })
    expect(result.current.annotations).toHaveLength(1)
    expect(result.current.taskChecks.pending).toHaveLength(1)

    act(() => result.current.send({ content: "  Done  ", attachment: null }))

    await waitFor(() => expect(sent).toHaveLength(1))
    const lines = sent[0]?.content.split("\n")
    expect(lines).toHaveLength(3)
    expect(lines?.[0]).toBe("Done")
    expect(lines?.[1]).toContain("The tool accepts team")
    expect(lines?.[1]).toContain("Check the name")
    expect(lines?.[2]).toBe(`<checked reply="${replyId}" item="1">The tool accepts team</checked>`)
    expect(result.current.annotations).toEqual([])
    expect(result.current.taskChecks.pending).toEqual([])
    await waitFor(() => expect(result.current.isSending).toBe(false))
  })

  it("sends a failed message again as it left the first time", async () => {
    const sent = recordSentMessages()
    const { wrapper } = createChatWrapper()
    const { result } = renderHook(() => useConversationSend(conversation, [reply]), { wrapper })
    const attachmentDocumentId = crypto.randomUUID()
    act(() => result.current.saveAnnotation(annotate()))

    act(() =>
      result.current.retry({
        content: "Already composed",
        attachment: { documentId: attachmentDocumentId },
      }),
    )

    await waitFor(() => expect(sent).toHaveLength(1))
    // The annotation waiting for the next message did not join the message sent again.
    expect(sent).toEqual([{ content: "Already composed", attachmentDocumentId }])
    expect(result.current.annotations).toHaveLength(1)
    await waitFor(() => expect(result.current.isSending).toBe(false))
  })
})
