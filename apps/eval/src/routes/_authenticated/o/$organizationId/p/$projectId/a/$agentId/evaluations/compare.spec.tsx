import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { extractionCompareUrlOf } from "@/test/eval-urls"
import { buildExtractionWorld } from "@/test/factories/eval-world.factory"
import { worldHandlers } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderApp } from "@/test/render-app"
import { required } from "@/test/required"

const UNEVEN_NOTE = /These runs did not ask the same number of records/

describe("the comparison of extraction runs", () => {
  it("shows each record with where it stands in each run", async () => {
    const world = buildExtractionWorld()
    server.use(...worldHandlers(world))
    renderApp(extractionCompareUrlOf(world))

    expect(await screen.findByRole("heading", { name: "Record by record" })).toBeInTheDocument()
    // A record of the dataset, named by what the agent read.
    expect(
      await screen.findByText("Can you explain how the shared workspaces work?"),
    ).toBeInTheDocument()
    expect(screen.queryByText(UNEVEN_NOTE)).not.toBeInTheDocument()
  })

  it("says so when the runs did not ask the same number of records", async () => {
    const world = buildExtractionWorld()
    // One of the runs compared asked the first records only.
    const partial = required(
      world.extractionRuns.find((candidate) => candidate.run.status === "completed"),
      "a completed run",
    )
    partial.records = partial.records.slice(0, 3)
    partial.run.summary = {
      total: 3,
      perfectMatches: partial.records.filter((record) => record.status === "match").length,
      mismatches: partial.records.filter((record) => record.status === "mismatch").length,
      errors: partial.records.filter((record) => record.status === "error").length,
      running: 0,
    }
    server.use(...worldHandlers(world))
    renderApp(extractionCompareUrlOf(world))

    expect(await screen.findByText(UNEVEN_NOTE)).toBeInTheDocument()
  })
})
