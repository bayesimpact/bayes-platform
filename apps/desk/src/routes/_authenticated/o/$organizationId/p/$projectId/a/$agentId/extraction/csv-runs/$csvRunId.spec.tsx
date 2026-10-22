import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
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

describe("an extraction of a CSV file", () => {
  it("shows its progress and its rows, a page at a time, and one row in full", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(extractionUrlsOf(world).csvRunUrl)

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

  it("adds the agent's answers to the table once the first rows are done", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    const [run] = world.csvExtractionRuns[world.agents[0]?.id ?? ""] ?? []
    if (!run) throw new Error("The world has a CSV run")
    // The run has just started: no row is done yet, and the first poll finds it so.
    run.status = "running"
    run.csvExportDocumentId = null
    for (const record of world.csvRecords[run.id] ?? []) {
      record.status = "running"
      record.agentRawOutput = null
    }
    const runsPath =
      "*/api/organizations/:organizationId/projects/:projectId/agents/:agentId/csv-extraction-runs/live"
    server.use(
      http.get(runsPath, () => HttpResponse.json({ data: [run] }), { once: true }),
      http.get(`${runsPath}/:runId`, () => HttpResponse.json({ data: run }), { once: true }),
    )
    renderApp(extractionUrlsOf(world).csvRunUrl)

    expect(await screen.findByText("From the file")).toBeInTheDocument()
    expect(screen.queryByText("Agent's answers")).not.toBeInTheDocument()
    expect(
      await screen.findByRole("columnheader", { name: "Agent's answers" }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /^Topic/ })).toBeInTheDocument()
  })

  it("is set up, then started on the first rows only", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(extractionUrlsOf(world).csvSetupUrl("articles.csv"))

    await screen.findByRole("heading", { name: "articles.csv" })
    for (const name of ["title", "author", "year", "abstract"]) {
      const group = screen.getByRole("group", { name: `What the agent does with ${name}` })
      await userEvent.click(within(group).getByRole("button", { name: "Skip" }))
    }
    expect(
      screen.getByText("Choose at least one column for the agent to read."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Extract every row" })).toBeDisabled()

    const title = screen.getByRole("group", { name: "What the agent does with title" })
    await userEvent.click(within(title).getByRole("button", { name: "Read" }))
    await userEvent.click(
      screen.getByRole("radio", { name: "The first rows only, to try the setup" }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Extract the first 10 rows" }))

    expect(await screen.findByText(/of 10 rows/)).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/\/extraction\/csv-runs\//)
  })
})

describe("a failed extraction of a CSV file", () => {
  it("starts again, says so, and its rows refresh at once", async () => {
    const world = buildExtractionAgentWorld()
    server.use(...worldHandlers(world))
    const [run] = world.csvExtractionRuns[world.agents[0]?.id ?? ""] ?? []
    if (!run) throw new Error("The world has a CSV run")
    run.status = "failed"
    renderApp(extractionUrlsOf(world).csvRunUrl)

    expect(await screen.findByText("The model did not answer in time.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("The run started again.")).toBeInTheDocument()
    // Sooner than the next poll of the rows: the retry refreshed them.
    await waitFor(() =>
      expect(screen.queryByText("The model did not answer in time.")).not.toBeInTheDocument(),
    )
  })
})
