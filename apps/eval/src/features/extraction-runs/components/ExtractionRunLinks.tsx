import type { AgentParamsDto } from "@bayes-platform/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { RunSidebarLinks } from "@/components/shared/RunSidebarLinks"
import { projectExtractionRunsQueryOptions } from "../api/queries"

export type ExtractionRunLinksProps = {
  agentParams: AgentParamsDto
  datasetId: string
}

/** The agent's extraction runs of the open dataset, under it in the sidebar. */
export function ExtractionRunLinks({ agentParams, datasetId }: ExtractionRunLinksProps) {
  const { data: projectRuns } = useSuspenseQuery(projectExtractionRunsQueryOptions(agentParams))
  const runs = projectRuns.filter(
    (run) => run.evaluationExtractionDatasetId === datasetId && run.agentId === agentParams.agentId,
  )
  return <RunSidebarLinks agentParams={agentParams} datasetId={datasetId} runs={runs} />
}
