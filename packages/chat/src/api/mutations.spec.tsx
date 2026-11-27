import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { createChatWrapper } from "../test/chat-wrapper"
import { apiError, mockRoute } from "../test/mock-route"
import { server } from "../test/server"
import { testRoutes } from "../test/test-chat"
import { useOpenAttachment, useOpenDocument, useSendFeedback } from "./mutations"

const conversation = {
  organizationId: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  agentId: crypto.randomUUID(),
  agentSessionId: crypto.randomUUID(),
}

/** The tab a click opened: its location is set once the URL arrives, and it can be closed. */
function createTab() {
  const tab = { location: { href: "" }, close: vi.fn() }
  // Safe: the hooks only set `location.href` and call `close`, which the fake has.
  return { tab, tabWindow: tab as unknown as Window }
}

describe("useSendFeedback", () => {
  it("sends a thumbs-up to the route of the message's feedback", async () => {
    const agentMessageId = crypto.randomUUID()
    const received: { agentMessageId: string; payload: unknown }[] = []
    server.use(
      mockRoute(testRoutes.conversation.createMessageFeedback, ({ params, payload }) => {
        received.push({ agentMessageId: params.agentMessageId, payload })
        return { success: true }
      }),
    )
    const { wrapper } = createChatWrapper()
    const { result } = renderHook(() => useSendFeedback(conversation), { wrapper })

    const answer = await act(() =>
      result.current.mutateAsync({ agentMessageId, feedback: { rating: "positive" } }),
    )

    expect(received).toEqual([{ agentMessageId, payload: { rating: "positive" } }])
    expect(answer).toEqual({ success: true })
  })
})

describe("useOpenDocument", () => {
  it("opens a cited document in the tab the click opened", async () => {
    const documentId = crypto.randomUUID()
    const url = `https://storage.example.test/${crypto.randomUUID()}`
    const requested: string[] = []
    server.use(
      mockRoute(testRoutes.documents.getTemporaryUrl, ({ params }) => {
        requested.push(params.documentId)
        return { url }
      }),
    )
    const { wrapper } = createChatWrapper()
    const { result } = renderHook(() => useOpenDocument(conversation), { wrapper })
    const { tab, tabWindow } = createTab()

    await act(() => result.current.mutateAsync({ documentId, tab: tabWindow }))

    expect(requested).toEqual([documentId])
    expect(tab.location.href).toBe(url)
    expect(tab.close).not.toHaveBeenCalled()
  })

  it("closes the tab when the URL cannot be had", async () => {
    server.use(mockRoute(testRoutes.documents.getTemporaryUrl, () => apiError(403)))
    const { wrapper } = createChatWrapper()
    const { result } = renderHook(() => useOpenDocument(conversation), { wrapper })
    const { tab, tabWindow } = createTab()

    act(() => result.current.mutate({ documentId: crypto.randomUUID(), tab: tabWindow }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(tab.close).toHaveBeenCalledTimes(1)
    expect(tab.location.href).toBe("")
  })

  it("closes the tab when the URL is not https", async () => {
    server.use(
      mockRoute(testRoutes.documents.getTemporaryUrl, () => ({
        url: "http://storage.example.test/file",
      })),
    )
    const { wrapper } = createChatWrapper()
    const { result } = renderHook(() => useOpenDocument(conversation), { wrapper })
    const { tab, tabWindow } = createTab()

    act(() => result.current.mutate({ documentId: crypto.randomUUID(), tab: tabWindow }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(tab.close).toHaveBeenCalledTimes(1)
    expect(tab.location.href).toBe("")
  })
})

describe("useOpenAttachment", () => {
  it("opens the file a person attached in the tab the click opened", async () => {
    const attachmentDocumentId = crypto.randomUUID()
    const url = `https://storage.example.test/${crypto.randomUUID()}`
    const requested: string[] = []
    server.use(
      mockRoute(testRoutes.conversation.getAttachmentUrl, ({ params }) => {
        requested.push(params.attachmentDocumentId)
        return { url }
      }),
    )
    const { wrapper } = createChatWrapper()
    const { result } = renderHook(() => useOpenAttachment(conversation), { wrapper })
    const { tab, tabWindow } = createTab()

    await act(() => result.current.mutateAsync({ attachmentDocumentId, tab: tabWindow }))

    expect(requested).toEqual([attachmentDocumentId])
    expect(tab.location.href).toBe(url)
  })
})
