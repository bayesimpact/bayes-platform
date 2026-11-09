import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, onTestFinished, vi } from "vitest"
import { appUpdate } from "@/lib/app-update"
import { agentUrlOf, conversationUrlOf, routerPathOf } from "@/test/desk-urls"
import { buildDeskWorld } from "@/test/factories/desk-world.factory"
import { writeMessage } from "@/test/message-box"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

/** The warning of the banner once a new release is out. */
const BANNER_TEXT = "Reloading the page clears what you have not sent or saved."

/** Opens a new conversation, with the page's reload watched. */
async function openNewConversation() {
  const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined)
  onTestFinished(() => {
    reload.mockRestore()
  })
  const world = buildDeskWorld()
  server.use(...worldHandlers(world))
  const { router } = renderApp(agentUrlOf(world))
  const messageBox = await screen.findByRole("textbox", { name: /^Message to/ })
  const goToConversation = () =>
    act(() => router.navigate({ href: routerPathOf(conversationUrlOf(world)) }))
  return { reload, messageBox, router, goToConversation }
}

describe("a new release of the Desk", () => {
  it("shows a banner whose button reloads the page, and nothing reloads on its own", async () => {
    const { reload, messageBox } = await openNewConversation()
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument()
    await writeMessage(messageBox, "Draft of my question")

    act(() => appUpdate.reportStaleBuild())

    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument()
    expect(messageBox).toHaveTextContent("Draft of my question")
    expect(reload).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Reload" }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it("loads in full on the next move to another page", async () => {
    const { reload, goToConversation } = await openNewConversation()
    act(() => appUpdate.reportStaleBuild())

    await goToConversation()

    expect(reload).toHaveBeenCalledOnce()
  })

  it("keeps the move a client one while a request changes data, as the first message does", async () => {
    const { reload, messageBox } = await openNewConversation()
    act(() => appUpdate.reportStaleBuild())

    // Sending the first message creates the conversation, then opens its page, then streams.
    await writeMessage(messageBox, "Compare the plans", { send: true })

    expect(
      await screen.findByText(/Here is what I found about "Compare the plans"/),
    ).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it("keeps a change of the page's search a client one", async () => {
    const { reload, router } = await openNewConversation()
    act(() => appUpdate.reportStaleBuild())

    await act(() => router.navigate({ href: `${router.state.location.pathname}?probe=1` }))

    expect(reload).not.toHaveBeenCalled()
  })

  it("counts a file of this release gone from the server, as Vite tells", async () => {
    await openNewConversation()

    act(() => {
      window.dispatchEvent(new Event("vite:preloadError"))
    })

    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument()
  })
})
