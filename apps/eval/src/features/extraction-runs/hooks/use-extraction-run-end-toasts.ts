import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useRunEndToasts } from "@/hooks/use-run-end-toasts"
import { agentRunsToWatch } from "@/lib/watched-runs"
import { projectExtractionRunsQueryOptions } from "../api/queries"

/**
 * Tells the person when a run of the agent ends, on a page that lists them, with the dataset it
 * asked: the list is read again by itself while a run is under way.
 */
export function useExtractionRunEndToasts(
  agent: AgentParamsDto,
  /** The datasets of the project, which name each run's. */
  datasets: { id: string; name: string }[],
): void {
  const { data: runs } = useSuspenseQuery(projectExtractionRunsQueryOptions(agent))
  useRunEndToasts(
    agentRunsToWatch(runs, agent.agentId, (run) => run.evaluationExtractionDatasetId, datasets),
  )
}
