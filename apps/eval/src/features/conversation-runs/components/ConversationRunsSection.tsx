import type {
  AgentParamsDto,
  AgentVersionOutputDto,
  ConversationDatasetParamsDto,
  ConversationRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { useState } from "react"
import { DataTable } from "@/components/shared/DataTable"
import { DeleteRunDialog } from "@/components/shared/DeleteRunDialog"
import { RunRowActions } from "@/components/shared/RunRowActions"
import { RunsByStatus } from "@/components/shared/RunsByStatus"
import { RunVersionButton } from "@/components/shared/RunVersionButton"
import { AgentVersionsSheet, agentVersionsQueryOptions } from "@/features/campaigns"
import { useDeleteConversationRun } from "../api/mutations"
import { projectConversationRunsQueryOptions } from "../api/queries"
import { conversationRunColumnsOf } from "./conversation-run-columns"

export type ConversationRunsSectionProps = {
  agentParams: AgentParamsDto
  /** The name of the agent, which titles the history of its versions. */
  agentName: string
  dataset: ConversationDatasetParamsDto
  /** Whether the person deletes runs. */
  canDelete: boolean
}

/**
 * The runs of the agent on a dataset, in one sub-tab per status, the
 * newest first in each.
 */
export function ConversationRunsSection({
  agentParams,
  agentName,
  dataset,
  canDelete,
}: ConversationRunsSectionProps) {
  const { data: projectRuns } = useSuspenseQuery(projectConversationRunsQueryOptions(dataset))
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  // The version a run asked, whose history shows.
  const [shownRevision, setShownRevision] = useState<number | null>(null)
  const shownVersion = versions.find((version) => version.revision === shownRevision)
  const deleteRun = useDeleteConversationRun(dataset)
  // The agent's own runs: the sidebar names the agent, so the page is about it alone.
  const runs = projectRuns.filter(
    (run) =>
      run.evaluationConversationDatasetId === dataset.datasetId &&
      run.agentId === agentParams.agentId,
  )
  return (
    <section className="flex flex-col gap-3">
      <RunsByStatus
        runs={runs}
        renderTable={(runsOfStatus) => (
          <RunsTable
            runs={runsOfStatus}
            agentParams={agentParams}
            datasetId={dataset.datasetId}
            versions={versions}
            onShowVersion={setShownRevision}
            onDelete={canDelete ? (run) => setDeletedId(run.id) : null}
          />
        )}
      />
      {shownVersion ? (
        <AgentVersionsSheet
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) setShownRevision(null)
          }}
          agentName={agentName}
          versions={versions}
          selectedId={shownVersion.id}
          selectedNote={<Trans>The run asked this version</Trans>}
          onSelect={null}
        />
      ) : null}
      <DeleteRunDialog runId={deletedId} onClose={() => setDeletedId(null)} deleteRun={deleteRun} />
    </section>
  )
}

type RunsTableProps = {
  runs: ConversationRunOutputDto[]
  agentParams: AgentParamsDto
  datasetId: string
  /** The saved versions of the agent, which a run's version opens. */
  versions: AgentVersionOutputDto[]
  onShowVersion: (revision: number) => void
  /** Asks to delete a run, for who may; none hides the action. */
  onDelete: ((run: ConversationRunOutputDto) => void) | null
}

/** The runs that stand at one status. */
function RunsTable({
  runs,
  agentParams,
  datasetId,
  versions,
  onShowVersion,
  onDelete,
}: RunsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { i18n } = useLingui()
  const table = useReactTable({
    data: runs,
    columns: conversationRunColumnsOf({
      agent: agentParams,
      locale: i18n.locale,
      translate: (descriptor) => i18n._(descriptor),
      renderVersion: (run) => (
        <RunVersionButton
          revision={run.agentSettings.revision}
          versions={versions}
          onShow={onShowVersion}
        />
      ),
      renderActions: (run) => (
        <RunRowActions
          agentParams={agentParams}
          datasetId={datasetId}
          run={run}
          onDelete={onDelete ? () => onDelete(run) : null}
        />
      ),
    }),
    getRowId: (run) => run.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return <DataTable table={table} empty={null} />
}
