import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, onTestFinished, vi } from "vitest"
import { appUpdate } from "@/lib/app-update"
import { campaignUrlOf, routerPathOf, testerSessionUrlOf } from "@/test/eval-urls"
import { buildParticipantWorld } from "@/test/factories/eval-world.factory"
import { writeMessage } from "@/test/message-box"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

/** The warning of the banner once a new release is out. */
const BANNER_TEXT = "Reloading the page clears what you have not sent or saved."

/** Opens a tester's session, with the page's reload watched. */
async function openTesterSession() {
  const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined)
  onTestFinished(() => {
    reload.mockRestore()
  })
  const world = buildParticipantWorld()
  server.use(...worldHandlers(world))
  const { router } = renderApp(testerSessionUrlOf(world, "Support assistant pilot", 0))
  const messageBox = await screen.findByRole("textbox", { name: /^Message to/ })
  const goToCampaign = () =>
    act(() =>
      router.navigate({
        href: routerPathOf(`${campaignUrlOf(world, "Support assistant pilot")}/test`),
      }),
    )
  return { reload, messageBox, router, goToCampaign }
}

describe("a new release of the app", () => {
  it("shows a banner whose button reloads the page, and nothing reloads on its own", async () => {
    const { reload, messageBox } = await openTesterSession()
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
    const { reload, goToCampaign } = await openTesterSession()
    act(() => appUpdate.reportStaleBuild())

    await goToCampaign()

    expect(reload).toHaveBeenCalledOnce()
  })

  it("keeps the move a client one while a request changes data, as a message does", async () => {
    const { reload, messageBox } = await openTesterSession()
    act(() => appUpdate.reportStaleBuild())

    await writeMessage(messageBox, "Can we pay monthly?", { send: true })

    expect(await screen.findByText("Can we pay monthly?")).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
  })

  it("keeps a change of the page's search a client one", async () => {
    const { reload, router } = await openTesterSession()
    act(() => appUpdate.reportStaleBuild())

    await act(() => router.navigate({ href: `${router.state.location.pathname}?probe=1` }))

    expect(reload).not.toHaveBeenCalled()
  })

  it("counts a file of this release gone from the server, as Vite tells", async () => {
    await openTesterSession()

    act(() => {
      window.dispatchEvent(new Event("vite:preloadError"))
    })

    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument()
  })
})
