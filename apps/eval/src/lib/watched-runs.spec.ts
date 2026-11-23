import { describe, expect, it } from "vitest"
import { agentRunsToWatch } from "./watched-runs"

describe("agentRunsToWatch", () => {
  it("keeps the agent's runs, each with the name of its dataset", () => {
    const agentId = crypto.randomUUID()
    const otherAgentId = crypto.randomUUID()
    const datasetId = crypto.randomUUID()
    const runId = crypto.randomUUID()
    const runs = [
      { id: runId, status: "running" as const, agentId, datasetId },
      { id: crypto.randomUUID(), status: "running" as const, agentId: otherAgentId, datasetId },
    ]

    expect(
      agentRunsToWatch(runs, agentId, (run) => run.datasetId, [
        { id: datasetId, name: "Support questions" },
      ]),
    ).toEqual([{ id: runId, status: "running", datasetName: "Support questions" }])
  })

  it("names no dataset the project's list lacks", () => {
    const agentId = crypto.randomUUID()
    const runId = crypto.randomUUID()
    const runs = [
      { id: runId, status: "completed" as const, agentId, datasetId: crypto.randomUUID() },
    ]

    expect(agentRunsToWatch(runs, agentId, (run) => run.datasetId, [])).toEqual([
      { id: runId, status: "completed", datasetName: null },
    ])
  })
})
