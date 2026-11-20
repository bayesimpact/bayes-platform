import type {
  AgentParamsDto,
  AgentVersionOutputDto,
  ExtractionDatasetParamsDto,
  ExtractionRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { cn } from "cn"
import { DownloadIcon, GitCompareArrowsIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { DataTable } from "@/components/shared/DataTable"
import { DeleteRunDialog } from "@/components/shared/DeleteRunDialog"
import { RunRowActions } from "@/components/shared/RunRowActions"
import { RunsByStatus } from "@/components/shared/RunsByStatus"
import { RunVersionButton } from "@/components/shared/RunVersionButton"
import { Button, buttonVariants } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { AgentVersionsSheet, agentVersionsQueryOptions } from "@/features/campaigns"
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
  const compareLabel = (
    <>
      <GitCompareArrowsIcon data-icon="inline-start" aria-hidden />
      {comparedCount === 0 ? (
        <Trans comment="Opens the comparison of the runs picked in the list">Compare runs</Trans>
      ) : (
        <Plural value={comparedCount} one="Compare # run" other="Compare # runs" />
      )}
    </>
  )
  return (
    <section className="flex flex-col gap-3">
      <RunsByStatus
        runs={runs}
        actions={
          runs.length < 2 ? null : comparedCount >= 2 ? (
            <Link
              to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/compare"
              params={{ ...agentParams, datasetId: dataset.datasetId }}
              search={{ runs: compared.join(",") }}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {compareLabel}
            </Link>
          ) : (
            <Button variant="outline" disabled>
              {compareLabel}
            </Button>
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
          selectedNote={<Trans>The run asked this version</Trans>}
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
  const rowSelection = Object.fromEntries(pickedIds.map((runId) => [runId, true]))
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
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater
      const isPicked = (runId: string) => next[runId] === true
      // The runs of the other sub-tabs keep their place: this table only knows its own.
      const kept = pickedIds.filter(
        (runId) => isPicked(runId) || !runs.some((run) => run.id === runId),
      )
      const added = runs.flatMap((run) =>
        isPicked(run.id) && !pickedIds.includes(run.id) ? [run.id] : [],
      )
      onPickedChange([...kept, ...added])
    },
    getRowId: (run) => run.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return <DataTable table={table} empty={null} />
}
