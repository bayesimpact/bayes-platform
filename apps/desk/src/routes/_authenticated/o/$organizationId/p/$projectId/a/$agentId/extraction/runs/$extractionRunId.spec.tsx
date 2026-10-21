import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { extractionUrlsOf } from "@/test/extraction-urls"
import { buildExtractionAgentWorld } from "@/test/factories/desk-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"

vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  hasSession: async () => true,
  getAccessToken: async () => "test-token",
}))

beforeEach(() => {
  window.localStorage.clear()
})

describe("an extraction of a document", () => {
  it("shows the fields the agent filled in, and says what it did not find", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    renderApp(extractionUrlsOf(world).runUrl("quarterly-report.pdf"))

    expect(await screen.findByRole("heading", { name: "quarterly-report.pdf" })).toBeInTheDocument()
    expect(screen.getByText("Done")).toBeInTheDocument()
    const fields = screen.getByRole("tabpanel")
    expect(within(fields).getByText("Page count")).toBeInTheDocument()
    expect(within(fields).getByText("Quarterly report")).toBeInTheDocument()
    expect(within(fields).getByText("Not found")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Download quarterly-report.json" }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole("tab", { name: "JSON" }))
    expect(await screen.findByText("quarterly-report.json")).toBeInTheDocument()
    const wrap = screen.getByRole("button", { name: "Wrap long lines" })
    expect(wrap).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(wrap)
    expect(wrap).toHaveAttribute("aria-pressed", "true")
    // The JSON's header copies and downloads it, in place of the actions beside the tabs.
    expect(screen.getAllByRole("button", { name: "Download quarterly-report.json" })).toHaveLength(
      1,
    )
  })

  it("says why it failed, without a retry that would fail again", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    renderApp(extractionUrlsOf(world).runUrl("scanned-manual.pdf"))

    const alert = await screen.findByRole("alert")
    expect(
      within(alert).getByText(/The document has more pages than the agent can read at once/),
    ).toBeInTheDocument()
    expect(within(alert).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("is deleted after a confirmation, and leaves for a new extraction", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(extractionUrlsOf(world).runUrl("quarterly-report.pdf"))

    await screen.findByRole("heading", { name: "quarterly-report.pdf" })
    await userEvent.click(screen.getByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete the extraction" }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(
      await screen.findByRole("heading", { name: "What should Document Reader read?" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/\/extraction$/)
    expect(screen.queryByRole("link", { name: "quarterly-report.pdf" })).not.toBeInTheDocument()
  })
})
