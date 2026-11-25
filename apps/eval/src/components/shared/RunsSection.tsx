import type { AgentParamsDto, AgentVersionOutputDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { type ReactNode, useState } from "react"
import type { RunSummary } from "@/lib/run-status"
import { AgentVersionsSheet } from "./AgentVersionsSheet"
import { CompareRunsButton } from "./CompareRunsButton"
import { DeleteRunDialog } from "./DeleteRunDialog"
import type { MutationLike } from "./mutation-like"
import { RunsByStatus } from "./RunsByStatus"

/** What the section gives the table of the runs that stand at one status. */
export type RunsTableSlot<TRun> = {
  runs: TRun[]
  /** The saved versions of the agent, which a run's version opens. */
  versions: AgentVersionOutputDto[]
  /** The runs picked for the comparison. */
  pickedIds: string[]
  /** Takes the runs picked: those picked before, in their order, then the new ones. */
  onPickedChange: (pickedIds: string[]) => void
  onShowVersion: (revision: number) => void
  /** Asks to delete a run, for who may; none hides the action. */
  onDelete: ((run: TRun) => void) | null
}

export type RunsSectionProps<TRun extends RunSummary> = {
  agentParams: AgentParamsDto
  /** The name of the agent, which titles the history of its versions. */
  agentName: string
  datasetId: string
  /** The agent's runs of the dataset, the newest first. */
  runs: TRun[]
  versions: AgentVersionOutputDto[]
  /** Deletes a run, by its id, for who may; none hides the action. */
  deleteRun: MutationLike<string> | null
  /** The table of the runs that stand at one status: each type of agent has its columns. */
  renderTable: (slot: RunsTableSlot<TRun>) => ReactNode
}

/**
 * The runs of an agent on a dataset, for an agent of any type: one sub-tab per status, the newest
 * first in each. Two runs or more, picked by their boxes, open side by side in the comparison. A
 * run's version opens the history of the agent's versions, and a run is deleted after a
 * confirmation.
 */
export function RunsSection<TRun extends RunSummary>({
  agentParams,
  agentName,
  datasetId,
  runs,
  versions,
  deleteRun,
  renderTable,
}: RunsSectionProps<TRun>) {
  // The dialog that shows: the one that deletes a run, or the history of a run's version.
  const [dialog, setDialog] = useState<
    { kind: "delete"; runId: string } | { kind: "version"; revision: number } | null
  >(null)
  // The runs picked for the comparison, in the order they were picked.
  const [pickedIds, setPickedIds] = useState<string[]>([])
  // A run deleted since it was picked is no longer compared.
  const compared = pickedIds.filter((runId) => runs.some((run) => run.id === runId))
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
              datasetId={datasetId}
              comparedIds={compared}
            />
          )
        }
        renderTable={(runsOfStatus) =>
          renderTable({
            runs: runsOfStatus,
            versions,
            pickedIds: compared,
            onPickedChange: setPickedIds,
            onShowVersion: (revision) => setDialog({ kind: "version", revision }),
            onDelete: deleteRun ? (run) => setDialog({ kind: "delete", runId: run.id }) : null,
          })
        }
      />
      {runs.length >= 2 && compared.length < 2 ? (
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
      {deleteRun ? (
        <DeleteRunDialog
          runId={dialog?.kind === "delete" ? dialog.runId : null}
          onClose={() => setDialog(null)}
          deleteRun={deleteRun}
        />
      ) : null}
    </section>
  )
}
