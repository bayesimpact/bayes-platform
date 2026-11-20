import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { DatasetSidebarLinks } from "@/components/shared/DatasetSidebarLinks"
import { DatasetsSidebarEntries } from "@/components/shared/DatasetsSidebarEntries"
import { ExtractionRunLinks } from "@/features/extraction-runs"
import { projectExtractionDatasetsQueryOptions } from "../api/queries"

export type ExtractionDatasetsSidebarEntriesProps = {
  agentParams: AgentParamsDto
  /** Whether the person creates datasets: the menu then leads to a new one. */
  canCreate: boolean
}

/**
 * The entries of the sidebar's Evaluations menu for an extraction agent: the table of its
 * project's datasets, the way to a new one, then each dataset, the last changed first. The open
 * dataset lists its runs under it.
 */
export function ExtractionDatasetsSidebarEntries({
  agentParams,
  canCreate,
}: ExtractionDatasetsSidebarEntriesProps) {
  return (
    <DatasetsSidebarEntries agentParams={agentParams} canCreate={canCreate}>
      <DatasetLinks agentParams={agentParams} />
    </DatasetsSidebarEntries>
  )
}

function DatasetLinks({ agentParams }: Pick<ExtractionDatasetsSidebarEntriesProps, "agentParams">) {
  const { data: datasets } = useSuspenseQuery(projectExtractionDatasetsQueryOptions(agentParams))
  return (
    <DatasetSidebarLinks
      agentParams={agentParams}
      datasets={datasets}
      renderRuns={(datasetId) => (
        <ExtractionRunLinks agentParams={agentParams} datasetId={datasetId} />
      )}
    />
  )
}
