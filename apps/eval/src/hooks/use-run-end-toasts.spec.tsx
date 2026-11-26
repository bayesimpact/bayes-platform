import { Toaster } from "@caseai-connect/app-ui/components/sonner"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import type { WatchedRun } from "@/lib/watched-runs"
import { renderWithI18n } from "@/test/render-with-i18n"
import { useRunEndToasts } from "./use-run-end-toasts"

/** A page that watches runs, with the place the toasts show in, and what reads the runs again. */
function RunsWatched({ before, after }: { before: WatchedRun[]; after: WatchedRun[] }) {
  const [runs, setRuns] = useState(before)
  useRunEndToasts(runs)
  return (
    <>
      <button type="button" onClick={() => setRuns(after)}>
        Read again
      </button>
      <Toaster />
    </>
  )
}

/** Reads the runs once, then again with the status each of them took. */
async function readTwice(before: WatchedRun[], after: WatchedRun[]) {
  renderWithI18n(<RunsWatched before={before} after={after} />)
  await userEvent.click(screen.getByRole("button", { name: "Read again" }))
}

describe("useRunEndToasts", () => {
  it("says when a run under way completes", async () => {
    const id = crypto.randomUUID()
    await readTwice(
      [{ id, status: "running", datasetName: "Support questions" }],
      [{ id, status: "completed", datasetName: "Support questions" }],
    )

    expect(
      await screen.findByText("The evaluation run on Support questions is complete."),
    ).toBeInTheDocument()
  })

  it("says when a run of a dataset it cannot name completes", async () => {
    const id = crypto.randomUUID()
    await readTwice(
      [{ id, status: "running", datasetName: null }],
      [{ id, status: "completed", datasetName: null }],
    )

    expect(await screen.findByText("The evaluation run is complete.")).toBeInTheDocument()
  })

  it("says when a run under way fails", async () => {
    const id = crypto.randomUUID()
    await readTwice(
      [{ id, status: "pending", datasetName: "Support questions" }],
      [{ id, status: "failed", datasetName: "Support questions" }],
    )

    expect(
      await screen.findByText("The evaluation run on Support questions failed."),
    ).toBeInTheDocument()
  })

  it("says nothing for a run that was over when the page opened, or that a person cancelled", async () => {
    const over = crypto.randomUUID()
    const cancelled = crypto.randomUUID()
    await readTwice(
      [
        { id: over, status: "completed", datasetName: null },
        { id: cancelled, status: "running", datasetName: null },
      ],
      [
        { id: over, status: "completed", datasetName: null },
        { id: cancelled, status: "cancelled", datasetName: null },
      ],
    )

    expect(screen.queryByText("The evaluation run is complete.")).not.toBeInTheDocument()
    expect(screen.queryByText("The evaluation run failed.")).not.toBeInTheDocument()
  })
})
