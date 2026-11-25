import type { AgentParamsDto } from "@bayes-platform/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { DatasetSidebarLinks } from "@/components/shared/DatasetSidebarLinks"
import { DatasetsSidebarEntries } from "@/components/shared/DatasetsSidebarEntries"
import { ConversationRunLinks } from "@/features/conversation-runs"
import { projectConversationDatasetsQueryOptions } from "../api/queries"

export type ConversationDatasetsSidebarEntriesProps = {
  agentParams: AgentParamsDto
  /** Whether the person creates datasets: the menu then leads to a new one. */
  canCreate: boolean
}

/**
 * The entries of the sidebar's Evaluations menu for a conversation agent: the table of its
 * project's datasets, the way to a new one, then each dataset, the last changed first. The open
 * dataset lists its runs under it.
 */
export function ConversationDatasetsSidebarEntries({
  agentParams,
  canCreate,
}: ConversationDatasetsSidebarEntriesProps) {
  return (
    <DatasetsSidebarEntries agentParams={agentParams} canCreate={canCreate}>
      <DatasetLinks agentParams={agentParams} />
    </DatasetsSidebarEntries>
  )
}

function DatasetLinks({
  agentParams,
}: Pick<ConversationDatasetsSidebarEntriesProps, "agentParams">) {
  const { data: datasets } = useSuspenseQuery(projectConversationDatasetsQueryOptions(agentParams))
  return (
    <DatasetSidebarLinks
      agentParams={agentParams}
      datasets={datasets}
      renderRuns={(datasetId) => (
        <ConversationRunLinks agentParams={agentParams} datasetId={datasetId} />
      )}
    />
  )
}
