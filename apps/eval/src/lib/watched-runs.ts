import type { RunStatus } from "./run-status"

/** A run a page watches: where it stands, and the name of the dataset it asks, when known. */
export type WatchedRun = { id: string; status: RunStatus; datasetName: string | null }

/**
 * The runs a page of an agent watches, among the project's: the agent's own, each with the name
 * of its dataset. The runs of the other agents of the project belong to their own pages.
 */
export function agentRunsToWatch<TRun extends { id: string; status: RunStatus; agentId: string }>(
  runs: TRun[],
  agentId: string,
  /** The dataset a run asks: each type of agent names its field. */
  datasetIdOf: (run: TRun) => string,
  /** The datasets of the project, which name each run's. */
  datasets: { id: string; name: string }[],
): WatchedRun[] {
  return runs
    .filter((run) => run.agentId === agentId)
    .map((run) => ({
      id: run.id,
      status: run.status,
      datasetName: datasets.find((dataset) => dataset.id === datasetIdOf(run))?.name ?? null,
    }))
}
