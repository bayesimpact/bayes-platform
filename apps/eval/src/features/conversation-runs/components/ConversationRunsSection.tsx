import type {
  AgentParamsDto,
  ConversationDatasetParamsDto,
  ConversationRunOutputDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { cn } from "cn"
import { EllipsisIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { Button, buttonVariants } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { flattenEvaluationAgents, useEvaluationWorkspace } from "@/features/agents"
import { fullDateTimeOf } from "@/lib/format-time"
import { useDeleteConversationRun } from "../api/mutations"
import { projectConversationRunsQueryOptions } from "../api/queries"
import { RUN_STATUS_LABELS, RUN_STATUS_ORDER } from "../run-status"
import { conversationRunColumnsOf } from "./conversation-run-columns"

export type ConversationRunsSectionProps = {
  agentParams: AgentParamsDto
  dataset: ConversationDatasetParamsDto
  /** Whether the person deletes runs. */
  canDelete: boolean
}

/**
 * The runs of a dataset by any conversation agent of its project, in one sub-tab per status, the
 * newest first in each.
 */
export function ConversationRunsSection({
  agentParams,
  dataset,
  canDelete,
}: ConversationRunsSectionProps) {
  const { t, i18n } = useLingui()
  const { data: projectRuns } = useSuspenseQuery(projectConversationRunsQueryOptions(dataset))
  const { groups } = useEvaluationWorkspace()
  const [deleted, setDeleted] = useState<ConversationRunOutputDto | null>(null)
  const deleteRun = useDeleteConversationRun(dataset)
  const runs = projectRuns.filter(
    (run) => run.evaluationConversationDatasetId === dataset.datasetId,
  )
  const agentNames = new Map(
    flattenEvaluationAgents(groups).map((agent) => [agent.id, agent.name] as const),
  )
  const runCount = runs.length
  // The statuses that hold runs, in the order of the sub-tabs.
  const statuses = RUN_STATUS_ORDER.filter((status) => runs.some((run) => run.status === status))
  const [firstStatus] = statuses
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          <Trans comment="The title of the runs of a dataset">Runs</Trans>
        </h2>
        <p className="text-sm text-muted-foreground">
          <Plural value={runCount} _0="No run yet" one="# run" other="# runs" />
        </p>
      </div>
      {runCount === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Trans>No evaluation ran on this dataset yet.</Trans>
        </p>
      ) : null}
      {firstStatus ? (
        // Its statuses as keys: a status that gains its first run, or loses its last one, starts
        // the sub-tabs afresh on one that holds runs.
        <Tabs key={statuses.join()} defaultValue={firstStatus}>
          <TabsList variant="line" className="max-w-full overflow-x-auto">
            {statuses.map((status) => {
              const statusName = i18n._(RUN_STATUS_LABELS[status])
              const count = i18n.number(runs.filter((run) => run.status === status).length)
              return (
                <TabsTrigger key={status} value={status}>
                  <Trans comment="A sub-tab of a dataset's runs: a status and how many runs stand at it">
                    {statusName} ({count})
                  </Trans>
                </TabsTrigger>
              )
            })}
          </TabsList>
          {statuses.map((status) => (
            <TabsContent key={status} value={status}>
              <RunsTable
                runs={runs.filter((run) => run.status === status)}
                agentParams={agentParams}
                datasetId={dataset.datasetId}
                agentNames={agentNames}
                onDelete={canDelete ? setDeleted : null}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
      <ConfirmDialog
        isOpen={deleted !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleted(null)
        }}
        title={<Trans>Delete this run?</Trans>}
        description={<Trans>The run and its results are deleted for good.</Trans>}
        confirmLabel={<Trans>Delete</Trans>}
        isDestructive
        isPending={deleteRun.isPending}
        onConfirm={() => {
          if (!deleted) return
          deleteRun.mutate(deleted.id, {
            onSuccess: () => {
              toast.success(t`The run was deleted.`)
              setDeleted(null)
            },
            onError: () => toast.error(t`The run could not be deleted. Try again.`),
          })
        }}
      />
    </section>
  )
}

type RunsTableProps = {
  runs: ConversationRunOutputDto[]
  agentParams: AgentParamsDto
  datasetId: string
  /** The names of the project's agents, by id. */
  agentNames: Map<string, string>
  /** Asks to delete a run, for who may; none hides the action. */
  onDelete: ((run: ConversationRunOutputDto) => void) | null
}

/** The runs that stand at one status. */
function RunsTable({ runs, agentParams, datasetId, agentNames, onDelete }: RunsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const table = useReactTable({
    data: runs,
    columns: conversationRunColumnsOf({
      agent: agentParams,
      agentNames,
      locale: i18n.locale,
      translate: (descriptor) => i18n._(descriptor),
      renderActions: (run) => {
        const started = fullDateTimeOf(run.createdAt, i18n.locale)
        return (
          <ButtonGroup>
            <Link
              to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId"
              params={{ ...agentParams, datasetId: datasetId, runId: run.id }}
              aria-label={t`Open the run of ${started}`}
              // The group joins its parts by their slot, which a link styled as a button lacks.
              data-slot="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Trans comment="Opens a run from the list of runs">Open</Trans>
            </Link>
            {onDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={t`More actions on the run of ${started}`}
                    />
                  }
                >
                  <EllipsisIcon aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(run)}>
                    <Trash2Icon aria-hidden />
                    <Trans comment="Deletes a run">Delete</Trans>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </ButtonGroup>
        )
      },
    }),
    getRowId: (run) => run.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return <DataTable table={table} empty={null} />
}
