import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, onTestFinished, vi } from "vitest"
import { extractionUrlsOf, routerPathOf } from "@/test/desk-urls"
import { buildExtractionAgentWorld } from "@/test/factories/desk-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

/**
 * How often the sidebar's history polls while an extraction goes on, which is also how long the
 * mocked agent reads a document.
 */
const POLL_INTERVAL_IN_MILLISECONDS = 5000

describe("an extraction that ends while the person is on another page", () => {
  it("says so in a toast, whose button opens it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    onTestFinished(() => {
      vi.useRealTimers()
    })
    // The world's notes are being read, and are read by the history's next poll.
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    const { newExtractionUrl, runUrl } = extractionUrlsOf(world)
    const { router } = renderApp(newExtractionUrl)

    expect(
      await screen.findByRole("link", { name: "meeting-notes.md In progress" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("meeting-notes.md is extracted.")).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_IN_MILLISECONDS))

    expect(await screen.findByText("meeting-notes.md is extracted.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Open" }))

    expect(await screen.findByRole("heading", { name: "meeting-notes.md" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(routerPathOf(runUrl("meeting-notes.md")))
  })
})
