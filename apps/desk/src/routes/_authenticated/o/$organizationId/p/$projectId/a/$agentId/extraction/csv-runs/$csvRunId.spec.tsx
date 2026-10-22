import { DeskAgentSessionsRoutes, DeskCsvExtractionsRoutes } from "@caseai-connect/desk-contracts"
import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, onTestFinished, vi } from "vitest"
import { agentOf, extractionUrlsOf } from "@/test/desk-urls"
import { buildExtractionAgentWorld, type DeskWorld } from "@/test/factories/desk-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"
import { required } from "@/test/required"

/** How often the page of a running CSV run polls it. */
const POLL_INTERVAL_IN_MILLISECONDS = 2000

/** A world with an extraction agent, served by the mocked API, which the test reads back. */
function serveExtractionWorld(): DeskWorld {
  const world = buildExtractionAgentWorld()
  server.use(...worldHandlers(world))
  return world
}

/** The world's run of `articles.csv`, which the test sets in another state before the page opens. */
function articlesRunOf(world: DeskWorld) {
  const [run] = world.csvExtractionRuns[agentOf(world).id] ?? []
  return required(run, "the CSV run of articles.csv")
}

/** Sets the run back to its start: running, with no row done yet. */
function restartRun(world: DeskWorld) {
  const run = articlesRunOf(world)
  run.status = "running"
  run.csvExportDocumentId = null
  for (const record of world.csvRecords[run.id] ?? []) {
    record.status = "running"
    record.agentRawOutput = null
  }
  return run
}

describe("an extraction of a CSV file", () => {
  it("shows its progress and its rows, a page at a time, and one row in full", async () => {
    const world = serveExtractionWorld()
    const { router } = renderApp(extractionUrlsOf(world).csvRunUrl("articles.csv"))

    expect(await screen.findByRole("heading", { name: "articles.csv" })).toBeInTheDocument()
    expect(screen.getByText("24 of 24 rows")).toBeInTheDocument()
    expect(screen.getByText("1 failed")).toBeInTheDocument()
    expect(screen.getByText("Rows 1–20 of 24")).toBeInTheDocument()
    expect(screen.getByText("The model did not answer in time.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Download the results" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Open row 2" }))
    const panel = await screen.findByRole("complementary", { name: "Row 2" })
    expect(within(panel).getByText("Agent's answers")).toBeInTheDocument()
    expect(within(panel).getByText("From the file")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Next page" }))
    expect(await screen.findByText("Rows 21–24 of 24")).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ page: 1 })
  })

  it("opens its first page when the page in the URL is not one", async () => {
    const world = serveExtractionWorld()
    const { router } = renderApp(`${extractionUrlsOf(world).csvRunUrl("articles.csv")}?page=-2`)

    expect(await screen.findByText("Rows 1–20 of 24")).toBeInTheDocument()
    expect(router.state.location.search).toEqual({})
  })

  it("adds the agent's answers to the table once the first rows are done", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const world = serveExtractionWorld()
    const run = restartRun(world)
    // The first poll finds the run as it started: no row done yet.
    server.use(
      mockRoute(DeskAgentSessionsRoutes.getCsvExtractionRuns, () => [run], { once: true }),
      mockRoute(DeskCsvExtractionsRoutes.getOne, () => run, { once: true }),
    )
    renderApp(extractionUrlsOf(world).csvRunUrl("articles.csv"))

    expect(await screen.findByText("From the file")).toBeInTheDocument()
    expect(screen.queryByText("Agent's answers")).not.toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_IN_MILLISECONDS))

    expect(await screen.findByRole("columnheader", { name: "Agent's answers" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /^Topic/ })).toBeInTheDocument()
  })

  it("stops while it runs, and keeps the rows done", async () => {
    const world = serveExtractionWorld()
    restartRun(world)
    renderApp(extractionUrlsOf(world).csvRunUrl("articles.csv"))

    await userEvent.click(await screen.findByRole("button", { name: "Stop" }))

    expect(await screen.findByText("The run stopped. The rows done stay.")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Download the results" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument()
  })

  it("tries again the rows that failed, once it failed", async () => {
    const world = serveExtractionWorld()
    articlesRunOf(world).status = "failed"
    renderApp(extractionUrlsOf(world).csvRunUrl("articles.csv"))
    expect(await screen.findByText("1 failed")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Try again" }))

    // The agent answers the failed row this time.
    await waitFor(() =>
      expect(screen.queryByText("The model did not answer in time.")).not.toBeInTheDocument(),
    )
    expect(screen.queryByText("1 failed")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("is deleted after a confirmation, and leaves for a new extraction", async () => {
    const world = serveExtractionWorld()
    const { router } = renderApp(extractionUrlsOf(world).csvRunUrl("articles.csv"))

    await screen.findByRole("heading", { name: "articles.csv" })
    await userEvent.click(screen.getByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete the extraction" }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(
      await screen.findByRole("heading", { name: "What should Document Reader read?" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/\/extraction$/)
    expect(screen.queryByRole("link", { name: "articles.csv" })).not.toBeInTheDocument()
  })

  it("is not found for a run of someone else", async () => {
    const world = serveExtractionWorld()
    renderApp(`${extractionUrlsOf(world).newExtractionUrl}/csv-runs/${crypto.randomUUID()}`)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })
})
