import { TRACE_READ_PERMISSION } from "@caseai-connect/eval-contracts"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { conversationDatasetUrlOf, conversationRunUrlOf, evaluationsUrlOf } from "@/test/eval-urls"
import { buildMe } from "@/test/factories/account.factory"
import { buildEvalWorld } from "@/test/factories/eval-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"
import { required } from "@/test/required"

const rowCount = () => screen.getAllByRole("row").length - 1

describe("a conversation run's page", () => {
  it("keeps the filter of its results in the URL", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(`${conversationRunUrlOf(world, "completed")}?result=errors`)

    // The URL names the filter: the page opens on the errors.
    const filters = await screen.findByRole("group", { name: "Filter the results" })
    expect(rowCount()).toBe(1)
    expect(screen.getByText("The model did not answer in time.")).toBeInTheDocument()

    await userEvent.click(within(filters).getByRole("button", { name: "Low scores (1)" }))
    await waitFor(() => expect(router.state.location.search).toMatchObject({ result: "lowScores" }))

    await userEvent.click(within(filters).getByRole("button", { name: "All (12)" }))
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty("result"))
    expect(rowCount()).toBe(12)
  })

  it("shows every result for a filter the URL names and the app does not know", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(`${conversationRunUrlOf(world, "completed")}?result=unknown`)

    await screen.findByRole("group", { name: "Filter the results" })
    expect(rowCount()).toBe(12)
  })

  it("is not found under another dataset", async () => {
    const world = buildEvalWorld()
    const { run } = required(
      world.conversationRuns.find((candidate) => candidate.run.status === "completed"),
      "a completed run",
    )
    server.use(...worldHandlers(world))
    renderApp(`${evaluationsUrlOf(world)}/${crypto.randomUUID()}/runs/${run.id}`)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
  })

  it("is not found for a run another agent of the project asked", async () => {
    const world = buildEvalWorld()
    const { run } = required(
      world.conversationRuns.find((candidate) => candidate.run.status === "completed"),
      "a completed run",
    )
    run.agentId = crypto.randomUUID()
    server.use(...worldHandlers(world))
    renderApp(`${evaluationsUrlOf(world)}/${run.evaluationConversationDatasetId}/runs/${run.id}`)

    expect(await screen.findByText("Page not found")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Filter the results" })).not.toBeInTheDocument()
  })

  it("asks a failed run its records again, and says so", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    renderApp(conversationRunUrlOf(world, "failed"))

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Retry" }))

    expect(await screen.findByText("The run started again.")).toBeInTheDocument()
  })

  it("deletes a run after a confirmation, then goes back to the runs of its dataset", async () => {
    const world = buildEvalWorld()
    const runCountBefore = world.conversationRuns.length
    server.use(...worldHandlers(world))
    const { router } = renderApp(conversationRunUrlOf(world, "completed"))

    await userEvent.click(await screen.findByRole("button", { name: "More actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this run?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(world.conversationRuns).toHaveLength(runCountBefore - 1))
    await waitFor(() => expect(router.state.location.search).toMatchObject({ tab: "runs" }))
  })

  /** A world whose first completed run has a record with a trace, and what opens that record. */
  const buildWorldWithTrace = () => {
    const world = buildEvalWorld()
    const { records } = required(
      world.conversationRuns.find((candidate) => candidate.run.status === "completed"),
      "a completed run",
    )
    const record = required(records[0], "a record of the run")
    record.traceUrl = "https://traces.example.org/sessions/sample"
    const openRecord = async () => {
      await userEvent.click(
        await screen.findByRole("button", { name: `Open the result of: ${record.input}` }),
      )
      return screen.findByRole("dialog", { name: "Result" })
    }
    return { world, openRecord }
  }

  it("links to the trace of an answer for who may read traces", async () => {
    const { world, openRecord } = buildWorldWithTrace()
    server.use(...worldHandlers(world, buildMe({ globalPermissions: [TRACE_READ_PERMISSION] })))
    renderApp(conversationRunUrlOf(world, "completed"))

    const link = await within(await openRecord()).findByRole("link", { name: /Open the trace/ })
    expect(link).toHaveAttribute("href", "https://traces.example.org/sessions/sample")
  })

  it("shows no link to the trace for the others", async () => {
    const { world, openRecord } = buildWorldWithTrace()
    server.use(...worldHandlers(world))
    renderApp(conversationRunUrlOf(world, "completed"))

    const sheet = await openRecord()
    expect(within(sheet).queryByRole("link", { name: /Open the trace/ })).not.toBeInTheDocument()
  })
})

describe("the runs of a conversation dataset", () => {
  it("keeps the status whose runs show in the URL", async () => {
    const world = buildEvalWorld()
    server.use(...worldHandlers(world))
    const { router } = renderApp(
      `${conversationDatasetUrlOf(world, "Pricing questions")}?tab=runs&status=completed`,
    )

    // The URL names the status: its sub-tab is the one that shows.
    const completed = await screen.findByRole("tab", { name: "Completed (2)" })
    expect(completed).toHaveAttribute("aria-selected", "true")

    await userEvent.click(screen.getByRole("tab", { name: "Failed (1)" }))
    await waitFor(() => expect(router.state.location.search).toMatchObject({ status: "failed" }))
  })
})
