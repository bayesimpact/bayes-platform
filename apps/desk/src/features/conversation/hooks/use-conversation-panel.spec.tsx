import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useConversationPanel } from "./use-conversation-panel"

describe("useConversationPanel", () => {
  it("opens one panel at a time, which its button closes again", () => {
    const { result } = renderHook(() => useConversationPanel())
    const resource = {
      kind: "page",
      title: "Plan comparison",
      description: null,
      url: "https://example.org/plans",
    } as const

    act(() => result.current.openResource(resource))
    expect(result.current.openedResource).toEqual(resource)

    act(() => result.current.toggle("memory"))
    expect(result.current.isMemoryOpen).toBe(true)
    expect(result.current.openedResource).toBeNull()

    act(() => result.current.toggle("memory"))
    expect(result.current.isMemoryOpen).toBe(false)
  })
})
