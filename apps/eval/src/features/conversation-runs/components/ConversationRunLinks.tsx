import type { AgentParamsDto } from "@bayes-platform/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { RunSidebarLinks } from "@/components/shared/RunSidebarLinks"
import { projectConversationRunsQueryOptions } from "../api/queries"

export type ConversationRunLinksProps = {
  agentParams: AgentParamsDto
  datasetId: string
}

/** The agent's conversation runs of the open dataset, under it in the sidebar. */
export function ConversationRunLinks({ agentParams, datasetId }: ConversationRunLinksProps) {
  const { data: projectRuns } = useSuspenseQuery(projectConversationRunsQueryOptions(agentParams))
  const runs = projectRuns.filter(
    (run) =>
      run.evaluationConversationDatasetId === datasetId && run.agentId === agentParams.agentId,
  )
  return <RunSidebarLinks agentParams={agentParams} datasetId={datasetId} runs={runs} />
}
