import {
  type AgentParamsDto,
  EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
  type ExtractionDatasetParamsDto,
} from "@caseai-connect/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import type { DatasetAction } from "@/components/shared/DatasetDialogs"
import { DatasetPageFrame, type DatasetTab } from "@/components/shared/DatasetPageFrame"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { ExtractionRunsSection } from "@/features/extraction-runs"
import { isSetUp } from "@/lib/extraction-columns"
import type { RecordsSearch } from "@/lib/records-search"
import { projectExtractionDatasetsQueryOptions } from "../api/queries"
import { ExtractionDatasetDialogs } from "./ExtractionDatasetDialogs"
import { ExtractionDatasetSetup } from "./ExtractionDatasetSetup"
import { ExtractionRecordsSection } from "./ExtractionRecordsSection"

export type ExtractionDatasetPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  datasetParams: ExtractionDatasetParamsDto
  /** The tab shown: the dataset's records, or its runs. */
  tab: DatasetTab
  /** Which records show: the page, the order and the search, from the URL. */
  recordsSearch: RecordsSearch
  onRecordsSearchChange: (search: RecordsSearch) => void
}

/**
 * An extraction dataset: its name, which its owner changes, then its records and its runs, in two
 * tabs, with the way to a new evaluation of the agent on it. A dataset that waits for its file
 * shows what builds its records instead.
 */
export function ExtractionDatasetPage({
  agent,
  agentParams,
  datasetParams,
  tab,
  recordsSearch,
  onRecordsSearchChange,
}: ExtractionDatasetPageProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { data: datasets } = useSuspenseQuery(projectExtractionDatasetsQueryOptions(datasetParams))
  const [action, setAction] = useState<DatasetAction | null>(null)
  const dataset = datasets.find((candidate) => candidate.id === datasetParams.datasetId)
  // The loader found the dataset: it is missing only while its deletion leaves the page.
  if (!dataset) return null
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const canUpdate = can(EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION)
  const hasRecords = isSetUp(dataset)
  return (
    <DatasetPageFrame
      agentParams={agentParams}
      dataset={dataset}
      tab={hasRecords ? tab : null}
      run={
        can(EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION)
          ? { disabledReason: hasRecords ? null : t`Build the dataset from a CSV file first.` }
          : null
      }
      onRename={canUpdate ? () => setAction({ kind: "rename", dataset }) : null}
      onDelete={
        can(EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION)
          ? () => setAction({ kind: "delete", dataset })
          : null
      }
    >
      {!hasRecords ? (
        <ExtractionDatasetSetup
          dataset={dataset}
          datasetParams={datasetParams}
          canEdit={canUpdate}
        />
      ) : tab === "runs" ? (
        <ExtractionRunsSection
          agentParams={agentParams}
          agentName={agent.name}
          dataset={datasetParams}
          canDelete={can(EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION)}
        />
      ) : (
        <ExtractionRecordsSection
          dataset={dataset}
          datasetParams={datasetParams}
          search={recordsSearch}
          onSearchChange={onRecordsSearchChange}
        />
      )}
      <ExtractionDatasetDialogs
        project={datasetParams}
        action={action}
        onClose={() => setAction(null)}
        onDeleted={() =>
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations",
            params: agentParams,
          })
        }
      />
    </DatasetPageFrame>
  )
}
