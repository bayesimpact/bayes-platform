import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ChatProvider } from "./ChatProvider"
import { useChat } from "./chat-context"
import { createTestChat } from "./test/test-chat"

describe("ChatProvider", () => {
  it("gives the chat to the hooks under it", () => {
    const chat = createTestChat()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChatProvider chat={chat}>{children}</ChatProvider>
    )

    const { result } = renderHook(() => useChat(), { wrapper })

    expect(result.current).toBe(chat)
  })

  it("says which provider is missing when a hook runs outside it", () => {
    // React logs the error a render throws: the spec reads it, not the console.
    vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => renderHook(() => useChat())).toThrow(/ChatProvider/)
  })
})
