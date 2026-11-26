import type {
  AgentParamsDto,
  ConversationDatasetParamsDto,
  ConversationRunOutputDto,
} from "@bayes-platform/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { RunRowActions } from "@/components/shared/RunRowActions"
import { RunsSection, type RunsTableSlot } from "@/components/shared/RunsSection"
import { RunVersionButton } from "@/components/shared/RunVersionButton"
import { agentVersionsQueryOptions } from "@/features/agents"
import { pickedAfterSelection, rowSelectionOf } from "@/lib/run-selection"
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
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  const deleteRun = useDeleteConversationRun(dataset)
  // The agent's own runs: the sidebar names the agent, so the page is about it alone.
  const runs = projectRuns.filter(
    (run) =>
      run.evaluationConversationDatasetId === dataset.datasetId &&
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

type RunsTableProps = RunsTableSlot<ConversationRunOutputDto> & {
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
  const { i18n } = useLingui()
  const rowSelection = rowSelectionOf(pickedIds)
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
