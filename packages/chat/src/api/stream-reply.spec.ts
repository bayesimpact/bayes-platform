import { TOOL_NAMES } from "@caseai-connect/chat-contracts"
import { type QueryClient, QueryObserver } from "@tanstack/react-query"
import { HttpResponse, http } from "msw"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ChatMessage, OutgoingMessage } from "../chat-messages"
import { apiError, type MockStreamFrame, mockRoute, mockStreamRoute } from "../test/mock-route"
import { server } from "../test/server"
import { createTestChat, createTestQueryClient, testRoutes } from "../test/test-chat"
import type { Chat } from "./create-chat"

const conversation = {
  organizationId: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  agentId: crypto.randomUUID(),
  agentSessionId: crypto.randomUUID(),
}

type ReplyFrame = MockStreamFrame<typeof testRoutes.conversation.streamReply>

const send = (content: string) => ({ content, attachment: null })

/** The messages of the conversation in the cache, as the screen reads them. */
const messagesIn = (queryClient: QueryClient, chat: Chat): ChatMessage[] =>
  queryClient.getQueryData(chat.messagesQueryOptions(conversation).queryKey) ?? []

const stops: (() => void)[] = []

/**
 * Puts a screen on the conversation: an observer on its messages, which refetch when the stream
 * invalidates them, as they do under a mounted conversation.
 */
function showConversation(queryClient: QueryClient, chat: Chat) {
  const options = chat.messagesQueryOptions(conversation)
  queryClient.setQueryData(options.queryKey, [])
  const observer = new QueryObserver(queryClient, {
    ...options,
    refetchInterval: false,
    staleTime: Number.POSITIVE_INFINITY,
  })
  stops.push(observer.subscribe(() => {}))
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

const startOf = (messageId: string): ReplyFrame => ({ event: { type: "start", messageId } })
const chunkOf = (messageId: string, content: string): ReplyFrame => ({
  event: { type: "chunk", messageId, content },
})
const endOf = (messageId: string, fullContent: string): ReplyFrame => ({
  event: { type: "end", messageId, fullContent },
})

/** A whole reply of one agent. */
const replyOf = (messageId: string, content: string): ReplyFrame[] => [
  startOf(messageId),
  chunkOf(messageId, content),
  endOf(messageId, content),
]

describe("streamReply", () => {
  it("writes the person's message, then the reply as its chunks come, then the persisted messages", async () => {
    const userMessageId = crypto.randomUUID()
    const replyId = crypto.randomUUID()
    const requestedContents: string[] = []
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, ({ payload }) => {
        requestedContents.push(payload.content)
        return [
          startOf(replyId),
          chunkOf(replyId, "Hello "),
          chunkOf(replyId, "world"),
          endOf(replyId, "Hello world"),
        ]
      }),
      mockRoute(testRoutes.conversation.getMessages, () => [
        { id: userMessageId, role: "user", content: "Question" },
        { id: replyId, role: "assistant", content: "Hello world", status: "completed" },
      ]),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()
    showConversation(queryClient, chat)
    const turns: ChatMessage[][] = []
    queryClient.getQueryCache().subscribe(() => turns.push(messagesIn(queryClient, chat)))

    await chat.streamReply(queryClient, conversation, send("Question"))

    // The reply ended: it is complete as the stream left it, before the persisted messages
    // replace it.
    const endedReply = messagesIn(queryClient, chat).find((message) => message.id === replyId)
    expect([endedReply?.content, endedReply?.status, endedReply?.failure]).toEqual([
      "Hello world",
      "completed",
      null,
    ])
    expect(requestedContents).toEqual(["Question"])
    const firstTurn = turns.find((messages) => messages.length === 2)
    expect(firstTurn?.map((message) => [message.role, message.content, message.status])).toEqual([
      ["user", "Question", "completed"],
      ["assistant", "", "streaming"],
    ])
    expect(
      turns.some((messages) =>
        messages.some((message) => message.content === "Hello " && message.status === "streaming"),
      ),
    ).toBe(true)
    expect(
      turns.some((messages) =>
        messages.some(
          (message) =>
            message.id === replyId && message.content === "Hello world" && message.failure === null,
        ),
      ),
    ).toBe(true)
    await vi.waitFor(() =>
      expect(messagesIn(queryClient, chat).map((message) => message.id)).toEqual([
        userMessageId,
        replyId,
      ]),
    )
  })

  it("opens a message of its own for a sub-agent that takes over", async () => {
    const firstReplyId = crypto.randomUUID()
    const subAgentReplyId = crypto.randomUUID()
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, () => [
        ...replyOf(firstReplyId, "I hand over."),
        ...replyOf(subAgentReplyId, "I take it from here."),
      ]),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()

    await chat.streamReply(queryClient, conversation, send("Question"))

    const replies = messagesIn(queryClient, chat).filter((message) => message.role === "assistant")
    expect(replies.map((reply) => [reply.id, reply.content, reply.status, reply.failure])).toEqual([
      [firstReplyId, "I hand over.", "completed", null],
      [subAgentReplyId, "I take it from here.", "completed", null],
    ])
  })

  it("fails the reply as `ended` when the stream closes before its end", async () => {
    const replyId = crypto.randomUUID()
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, () => [
        startOf(replyId),
        chunkOf(replyId, "Half of an ans"),
      ]),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()

    await chat.streamReply(queryClient, conversation, send("Question"))

    const reply = messagesIn(queryClient, chat).at(-1)
    expect([reply?.id, reply?.status, reply?.failure, reply?.content]).toEqual([
      replyId,
      "error",
      "ended",
      "Half of an ans",
    ])
  })

  it("fails the reply as `contract` on a frame that is not an event", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const framesThatBreakTheContract = [
      "this is not JSON",
      JSON.stringify({ type: "an_event_nobody_knows" }),
    ]
    for (const raw of framesThatBreakTheContract) {
      server.use(
        mockStreamRoute(testRoutes.conversation.streamReply, () => [
          startOf(crypto.randomUUID()),
          { raw },
          // Never read: the reply failed at the frame before.
          { stayOpen: true },
        ]),
      )
      const chat = createTestChat()
      const queryClient = createTestQueryClient()

      await chat.streamReply(queryClient, conversation, send("Question"))

      const reply = messagesIn(queryClient, chat).at(-1)
      expect([reply?.status, reply?.failure]).toEqual(["error", "contract"])
    }
    expect(consoleError).toHaveBeenCalledTimes(framesThatBreakTheContract.length)
  })

  it("fails the reply as `unreachable` when the request fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, () => apiError(503, "Unavailable")),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()

    await chat.streamReply(queryClient, conversation, send("Question"))

    const [userMessage, reply] = messagesIn(queryClient, chat)
    expect([userMessage?.content, reply?.status, reply?.failure, reply?.content]).toEqual([
      "Question",
      "error",
      "unreachable",
      "",
    ])
    expect(consoleError).toHaveBeenCalled()
  })

  it("uploads an attachment first, and fails the reply as `upload` when the upload fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const attachmentDocumentId = crypto.randomUUID()
    const replyId = crypto.randomUUID()
    const uploadUrl = `https://storage.example.test/${crypto.randomUUID()}`
    const file = new File(["%PDF-1.4"], "notes.pdf", { type: "application/pdf" })
    const streamedAttachments: (string | undefined)[] = []
    const presigned: unknown[] = []
    let uploadStatus = 200
    server.use(
      mockRoute(testRoutes.conversation.presignAttachment, ({ payload }) => {
        presigned.push(payload)
        return { attachmentDocumentId, uploadUrl }
      }),
      http.put(uploadUrl, () => new HttpResponse(null, { status: uploadStatus })),
      mockStreamRoute(testRoutes.conversation.streamReply, ({ payload }) => {
        streamedAttachments.push(payload.attachmentDocumentId)
        return replyOf(replyId, "I read it.")
      }),
    )
    const chat = createTestChat()

    const uploaded = createTestQueryClient()
    await chat.streamReply(uploaded, conversation, { content: "Read this", attachment: { file } })

    const [userMessage, reply] = messagesIn(uploaded, chat)
    expect(userMessage?.attachment).toMatchObject({ documentId: attachmentDocumentId })
    expect([reply?.status, reply?.content]).toEqual(["completed", "I read it."])
    expect(streamedAttachments).toEqual([attachmentDocumentId])
    expect(presigned).toEqual([{ fileName: "notes.pdf", mimeType: "application/pdf", size: 8 }])

    uploadStatus = 500
    const notUploaded = createTestQueryClient()
    await chat.streamReply(notUploaded, conversation, {
      content: "Read this",
      attachment: { file },
    })

    const [unsentMessage, failedReply] = messagesIn(notUploaded, chat)
    // The file stays on the person's message, so a retry can send it again.
    expect(unsentMessage?.attachment).toMatchObject({ documentId: null, file })
    expect([failedReply?.status, failedReply?.failure]).toEqual(["error", "upload"])
    expect(streamedAttachments).toEqual([attachmentDocumentId])
    expect(consoleError).toHaveBeenCalled()
  })

  it("stops without a failure when the person leaves, and loads the messages again", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const userMessageId = crypto.randomUUID()
    const replyId = crypto.randomUUID()
    let messageReads = 0
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, () => [
        startOf(replyId),
        chunkOf(replyId, "Still writing"),
        { stayOpen: true },
      ]),
      mockRoute(testRoutes.conversation.getMessages, () => {
        messageReads += 1
        return [
          { id: userMessageId, role: "user", content: "Question" },
          { id: replyId, role: "assistant", content: "Written to the end", status: "completed" },
        ]
      }),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()
    showConversation(queryClient, chat)

    const streaming = chat.streamReply(queryClient, conversation, send("Question"))
    await vi.waitFor(() =>
      expect(messagesIn(queryClient, chat).at(-1)?.content).toBe("Still writing"),
    )
    chat.stopReplyStream(conversation.agentSessionId)
    await streaming

    // Right away, before the refetch answers: the local reply stopped where it was, with no failure.
    const localReply = messagesIn(queryClient, chat).at(-1)
    expect([localReply?.content, localReply?.failure]).toEqual(["Still writing", null])
    expect(messageReads).toBe(0)

    await vi.waitFor(() =>
      expect(messagesIn(queryClient, chat).at(-1)?.content).toBe("Written to the end"),
    )
    expect(messageReads).toBe(1)
    expect(messagesIn(queryClient, chat).map((message) => message.failure)).toEqual([null, null])
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("records today's behaviour when a second stream starts: the first reply fails as ended", async () => {
    const firstReplyId = crypto.randomUUID()
    const secondReplyId = crypto.randomUUID()
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, ({ payload }) =>
        payload.content === "First"
          ? [startOf(firstReplyId), chunkOf(firstReplyId, "Writing"), { stayOpen: true }]
          : replyOf(secondReplyId, "Second answer"),
      ),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()

    const first = chat.streamReply(queryClient, conversation, send("First"))
    await vi.waitFor(() => expect(messagesIn(queryClient, chat).at(-1)?.content).toBe("Writing"))
    await chat.streamReply(queryClient, conversation, send("Second"))
    await first

    // The first reply stopped where it was, and the second one went to its end.
    const messages = messagesIn(queryClient, chat)
    const firstReply = messages.find((message) => message.id === firstReplyId)
    const secondReply = messages.find((message) => message.id === secondReplyId)
    expect(firstReply?.content).toBe("Writing")
    // Today's behaviour, kept from the Desk when two turns overlap: the first reply, still
    // streaming when the second turn ends, is failed as `ended` by that turn's closing check.
    expect([firstReply?.status, firstReply?.failure]).toEqual(["error", "ended"])
    expect([secondReply?.content, secondReply?.status, secondReply?.failure]).toEqual([
      "Second answer",
      "completed",
      null,
    ])
  })

  it("shows what the handler threw as the reply's error, from Nest's `error` frame", async () => {
    const replyId = crypto.randomUUID()
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, () => [
        startOf(replyId),
        { thrownError: "The agent broke" },
        // Never read: the reply stops at the error frame.
        { stayOpen: true },
      ]),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()

    await chat.streamReply(queryClient, conversation, send("Question"))

    const reply = messagesIn(queryClient, chat).at(-1)
    expect([reply?.id, reply?.status, reply?.content, reply?.failure]).toEqual([
      replyId,
      "error",
      "The agent broke",
      null,
    ])
  })

  it("fails the reply as `ended` on an `error` frame that carries no message", async () => {
    const replyId = crypto.randomUUID()
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, () => [
        startOf(replyId),
        chunkOf(replyId, "Half of an ans"),
        { thrownError: "" },
        // Never read: the reply stops at the error frame.
        { stayOpen: true },
      ]),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()

    await chat.streamReply(queryClient, conversation, send("Question"))

    const reply = messagesIn(queryClient, chat).at(-1)
    expect([reply?.id, reply?.status, reply?.failure, reply?.content]).toEqual([
      replyId,
      "error",
      "ended",
      "Half of an ans",
    ])
  })

  it("keeps the messages' query from polling and from refetching on focus while this tab streams", async () => {
    const replyId = crypto.randomUUID()
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, () => [
        startOf(replyId),
        chunkOf(replyId, "Still writing"),
        { stayOpen: true },
      ]),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()
    const options = chat.messagesQueryOptions(conversation)
    // The query the options describe, as the cache holds it: the stream writes into it.
    queryClient.setQueryData(options.queryKey, [])
    const query = new QueryObserver(queryClient, options).getCurrentQuery()
    const interval = () => {
      if (typeof options.refetchInterval !== "function") throw new Error("A function was expected")
      return options.refetchInterval(query)
    }
    const refetchesOnFocus = () => {
      if (typeof options.refetchOnWindowFocus !== "function") {
        throw new Error("A function was expected")
      }
      return options.refetchOnWindowFocus(query)
    }

    const streaming = chat.streamReply(queryClient, conversation, send("Question"))
    await vi.waitFor(() =>
      expect(messagesIn(queryClient, chat).at(-1)?.content).toBe("Still writing"),
    )

    expect([interval(), refetchesOnFocus()]).toEqual([false, false])

    chat.stopReplyStream(conversation.agentSessionId)
    await streaming

    // The reply is still being written as far as the cache tells: the query recovers it.
    expect([interval(), refetchesOnFocus()]).toEqual([2000, true])
  })

  it("calls onToolCalled for each tool the stream names, with its name", async () => {
    const replyId = crypto.randomUUID()
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, () => [
        startOf(replyId),
        { event: { type: "notify_client", toolName: TOOL_NAMES.fillForm } },
        { event: { type: "notify_client", toolName: "a_tool_of_an_mcp_server" } },
        { event: { type: "notify_client", toolName: TOOL_NAMES.saveMemory } },
        endOf(replyId, "Done"),
      ]),
    )
    const onToolCalled = vi.fn()
    const chat = createTestChat({ onToolCalled })
    const queryClient = createTestQueryClient()

    await chat.streamReply(queryClient, conversation, send("Question"))

    expect(onToolCalled.mock.calls).toEqual([
      [queryClient, conversation, TOOL_NAMES.fillForm],
      [queryClient, conversation, "a_tool_of_an_mcp_server"],
      [queryClient, conversation, TOOL_NAMES.saveMemory],
    ])
  })

  it("calls onReplySettled once, after a reply that ended, failed or was stopped", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const replyId = crypto.randomUUID()
    const uploadUrl = `https://storage.example.test/${crypto.randomUUID()}`
    const file = new File(["%PDF-1.4"], "notes.pdf", { type: "application/pdf" })
    const cases: {
      name: string
      frames: ReplyFrame[] | Response
      outgoing?: OutgoingMessage
      stopsTheReader?: boolean
      replyStatusWhenSettled: ChatMessage["status"]
      /** How many times the code logs on the way: where it fails, once, and nowhere else. */
      loggedErrors: number
    }[] = [
      {
        name: "ended",
        frames: replyOf(replyId, "Answer"),
        replyStatusWhenSettled: "completed",
        loggedErrors: 0,
      },
      {
        name: "failed",
        frames: apiError(503),
        replyStatusWhenSettled: "error",
        loggedErrors: 1,
      },
      {
        name: "stopped",
        frames: [startOf(replyId), chunkOf(replyId, "Writing"), { stayOpen: true }],
        stopsTheReader: true,
        replyStatusWhenSettled: "streaming",
        loggedErrors: 0,
      },
      {
        name: "a frame that is not an event",
        frames: [startOf(replyId), { raw: "this is not JSON" }, { stayOpen: true }],
        replyStatusWhenSettled: "error",
        loggedErrors: 1,
      },
      {
        name: "an error event of the stream",
        frames: [
          startOf(replyId),
          { event: { type: "error", messageId: replyId, error: "The agent broke" } },
          { stayOpen: true },
        ],
        replyStatusWhenSettled: "error",
        loggedErrors: 0,
      },
      {
        name: "an upload that fails",
        frames: [],
        outgoing: { content: "Read this", attachment: { file } },
        replyStatusWhenSettled: "error",
        loggedErrors: 1,
      },
    ]
    server.use(
      mockRoute(testRoutes.conversation.presignAttachment, () => ({
        attachmentDocumentId: crypto.randomUUID(),
        uploadUrl,
      })),
      http.put(uploadUrl, () => new HttpResponse(null, { status: 500 })),
    )
    for (const {
      name,
      frames,
      outgoing,
      stopsTheReader,
      replyStatusWhenSettled,
      loggedErrors,
    } of cases) {
      consoleError.mockClear()
      server.use(mockStreamRoute(testRoutes.conversation.streamReply, () => frames))
      const statusesWhenSettled: (ChatMessage["status"] | undefined)[] = []
      const queryClient = createTestQueryClient()
      const onReplySettled = vi.fn((settledClient: QueryClient) => {
        statusesWhenSettled.push(messagesIn(settledClient, chat).at(-1)?.status)
      })
      const chat = createTestChat({ onReplySettled })

      const streaming = chat.streamReply(queryClient, conversation, outgoing ?? send("Question"))
      if (stopsTheReader) {
        await vi.waitFor(() =>
          expect(messagesIn(queryClient, chat).at(-1)?.content).toBe("Writing"),
        )
        chat.stopReplyStream(conversation.agentSessionId)
      }
      await streaming

      expect(onReplySettled, name).toHaveBeenCalledTimes(1)
      expect(onReplySettled, name).toHaveBeenCalledWith(queryClient, conversation)
      expect(statusesWhenSettled, name).toEqual([replyStatusWhenSettled])
      expect(consoleError, name).toHaveBeenCalledTimes(loggedErrors)
    }
  })

  it("completes the reply and logs when a callback throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const replyId = crypto.randomUUID()
    server.use(
      mockStreamRoute(testRoutes.conversation.streamReply, () => [
        startOf(replyId),
        { event: { type: "notify_client", toolName: TOOL_NAMES.fillForm } },
        chunkOf(replyId, "Done"),
        endOf(replyId, "Done"),
      ]),
    )
    const onToolCalled = vi.fn(() => {
      throw new Error("The app's tool callback broke")
    })
    const onReplySettled = vi.fn(() => {
      throw new Error("The app's settled callback broke")
    })
    const chat = createTestChat({ onToolCalled, onReplySettled })
    const queryClient = createTestQueryClient()

    await chat.streamReply(queryClient, conversation, send("Question"))

    const reply = messagesIn(queryClient, chat).at(-1)
    expect([reply?.id, reply?.content, reply?.status, reply?.failure]).toEqual([
      replyId,
      "Done",
      "completed",
      null,
    ])
    expect(onToolCalled).toHaveBeenCalledTimes(1)
    expect(onReplySettled).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledTimes(2)
    expect(consoleError.mock.calls.map(([message]) => message)).toEqual([
      "onToolCalled failed:",
      "onReplySettled failed:",
    ])
  })
})
