import type {
  AgentParamsDto,
  AgentVersionOutputDto,
  ExtractionDatasetParamsDto,
  ExtractionRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { DownloadIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AgentVersionsSheet } from "@/components/shared/AgentVersionsSheet"
import { CompareRunsButton } from "@/components/shared/CompareRunsButton"
import { DataTable } from "@/components/shared/DataTable"
import { DeleteRunDialog } from "@/components/shared/DeleteRunDialog"
import { RunRowActions } from "@/components/shared/RunRowActions"
import { RunsByStatus } from "@/components/shared/RunsByStatus"
import { RunVersionButton } from "@/components/shared/RunVersionButton"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { agentVersionsQueryOptions } from "@/features/agents"
import { pickedAfterSelection, rowSelectionOf } from "@/lib/run-selection"
import { openBlankTab } from "@/lib/safe-url"
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
  const [dialog, setDialog] = useState<
    { kind: "delete"; runId: string } | { kind: "version"; revision: number } | null
  >(null)
  // The runs picked for the comparison, in the order they were picked.
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const deleteRun = useDeleteExtractionRun(dataset)
  // The agent's own runs: the sidebar names the agent, so the page is about it alone.
  const runs = projectRuns.filter(
    (run) =>
      run.evaluationExtractionDatasetId === dataset.datasetId &&
      run.agentId === agentParams.agentId,
  )
  // A run deleted since it was picked is no longer compared.
  const compared = pickedIds.filter((runId) => runs.some((run) => run.id === runId))
  const comparedCount = compared.length
  const shownVersion =
    dialog?.kind === "version"
      ? versions.find((version) => version.revision === dialog.revision)
      : undefined
  return (
    <section className="flex flex-col gap-3">
      <RunsByStatus
        runs={runs}
        actions={
          runs.length < 2 ? null : (
            <CompareRunsButton
              agentParams={agentParams}
              datasetId={dataset.datasetId}
              comparedIds={compared}
            />
          )
        }
        renderTable={(runsOfStatus) => (
          <RunsTable
            runs={runsOfStatus}
            agentParams={agentParams}
            datasetId={dataset.datasetId}
            versions={versions}
            pickedIds={compared}
            onPickedChange={setPickedIds}
            onShowVersion={(revision) => setDialog({ kind: "version", revision })}
            onDelete={canDelete ? (run) => setDialog({ kind: "delete", runId: run.id }) : null}
          />
        )}
      />
      {runs.length >= 2 && comparedCount < 2 ? (
        <p className="text-sm text-muted-foreground">
          <Trans>Check two runs or more to compare them.</Trans>
        </p>
      ) : null}
      {shownVersion ? (
        <AgentVersionsSheet
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) setDialog(null)
          }}
          agentName={agentName}
          versions={versions}
          selectedId={shownVersion.id}
          selectedNote={<Trans>The run used this version</Trans>}
          onSelect={null}
        />
      ) : null}
      <DeleteRunDialog
        runId={dialog?.kind === "delete" ? dialog.runId : null}
        onClose={() => setDialog(null)}
        deleteRun={deleteRun}
      />
    </section>
  )
}

type RunsTableProps = {
  runs: ExtractionRunOutputDto[]
  agentParams: AgentParamsDto
  datasetId: string
  /** The saved versions of the agent, which a run's version opens. */
  versions: AgentVersionOutputDto[]
  /** The runs picked for the comparison. */
  pickedIds: string[]
  /** Takes the runs picked: those picked before, in their order, then the new ones. */
  onPickedChange: (pickedIds: string[]) => void
  onShowVersion: (revision: number) => void
  /** Asks to delete a run, for who may; none hides the action. */
  onDelete: ((run: ExtractionRunOutputDto) => void) | null
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
