import { DropdownMenuItem } from "@caseai-connect/app-ui/components/dropdown-menu"
import type {
  AgentParamsDto,
  ExtractionDatasetParamsDto,
  ExtractionRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { openBlankTab } from "@caseai-connect/frontend-lib"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/shared/DataTable"
import { RunRowActions } from "@/components/shared/RunRowActions"
import { RunsSection, type RunsTableSlot } from "@/components/shared/RunsSection"
import { RunVersionButton } from "@/components/shared/RunVersionButton"
import { agentVersionsQueryOptions } from "@/features/agents"
import { pickedAfterSelection, rowSelectionOf } from "@/lib/run-selection"
import { useDeleteExtractionRun, useOpenRunCsv } from "../api/mutations"
import { projectExtractionRunsQueryOptions } from "../api/queries"
import { extractionRunColumnsOf } from "./extraction-run-columns"

export type ExtractionRunsSectionProps = {
  agentParams: AgentParamsDto
  /** The name of the agent, which titles the history of its versions. */
  agentName: string
  dataset: ExtractionDatasetParamsDto
  /** Whether the person deletes runs. */
  canDelete: boolean
}

/**
 * The extraction runs of the agent on a dataset, in one sub-tab per status, the newest first in
 * each. Two runs or more, picked by their boxes, open side by side in the comparison.
 */
export function ExtractionRunsSection({
  agentParams,
  agentName,
  dataset,
  canDelete,
}: ExtractionRunsSectionProps) {
  const { data: projectRuns } = useSuspenseQuery(projectExtractionRunsQueryOptions(dataset))
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const deleteRun = useDeleteExtractionRun(dataset)
  // The agent's own runs: the sidebar names the agent, so the page is about it alone.
  const runs = projectRuns.filter(
    (run) =>
      run.evaluationExtractionDatasetId === dataset.datasetId &&
      run.agentId === agentParams.agentId,
  )
  return (
    <RunsSection
      agentParams={agentParams}
      agentName={agentName}
      datasetId={dataset.datasetId}
      runs={runs}
      versions={versions}
      deleteRun={canDelete ? deleteRun : null}
      renderTable={(slot) => (
        <RunsTable {...slot} agentParams={agentParams} datasetId={dataset.datasetId} />
      )}
    />
  )
}

type RunsTableProps = RunsTableSlot<ExtractionRunOutputDto> & {
  agentParams: AgentParamsDto
  datasetId: string
}

/** The runs that stand at one status. */
function RunsTable({
  runs,
  agentParams,
  datasetId,
  versions,
  pickedIds,
  onPickedChange,
  onShowVersion,
  onDelete,
}: RunsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const openCsv = useOpenRunCsv(agentParams)
  const rowSelection = rowSelectionOf(pickedIds)
  const table = useReactTable({
    data: runs,
    columns: extractionRunColumnsOf({
      agent: agentParams,
      locale: i18n.locale,
      translate: (descriptor) => i18n._(descriptor),
      renderVersion: (run) => (
        <RunVersionButton revision={run.agentRevision} versions={versions} onShow={onShowVersion} />
      ),
      renderActions: (run) => {
        const documentId = run.csvExportDocumentId
        return (
          <RunRowActions
            agentParams={agentParams}
            datasetId={datasetId}
            run={run}
            menuItems={
              documentId ? (
                <DropdownMenuItem
                  onClick={() =>
                    openCsv.mutate(
                      { documentId, tab: openBlankTab() },
                      {
                        onError: () => toast.error(t`The CSV file could not be opened. Try again.`),
                      },
                    )
                  }
                >
                  <DownloadIcon aria-hidden />
                  <Trans comment="Opens the results of a run as a CSV file">Download CSV</Trans>
                </DropdownMenuItem>
              ) : null
            }
            onDelete={onDelete ? () => onDelete(run) : null}
          />
        )
      },
    }),
    state: { rowSelection },
    onRowSelectionChange: (updater) =>
      onPickedChange(
        pickedAfterSelection(
          pickedIds,
          runs.map((run) => run.id),
          typeof updater === "function" ? updater(rowSelection) : updater,
        ),
      ),
    getRowId: (run) => run.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return <DataTable table={table} empty={null} />
}
