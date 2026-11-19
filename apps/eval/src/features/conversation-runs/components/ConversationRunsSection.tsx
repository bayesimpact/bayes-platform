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
import { flattenEvaluationAgents, useEvaluationWorkspace } from "@/features/agents"
import { fullDateTimeOf } from "@/lib/format-time"
import { useDeleteConversationRun } from "../api/mutations"
import { projectConversationRunsQueryOptions } from "../api/queries"
import { conversationRunColumnsOf } from "./conversation-run-columns"

export type ConversationRunsSectionProps = {
  agentParams: AgentParamsDto
  dataset: ConversationDatasetParamsDto
  /** Whether the person deletes runs. */
  canDelete: boolean
}

/** The runs of a dataset, the newest first, by any conversation agent of its project. */
export function ConversationRunsSection({
  agentParams,
  dataset,
  canDelete,
}: ConversationRunsSectionProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
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
              params={{ ...agentParams, datasetId: dataset.datasetId, runId: run.id }}
              aria-label={t`Open the run of ${started}`}
              // The group joins its parts by their slot, which a link styled as a button lacks.
              data-slot="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Trans comment="Opens a run from the list of runs">Open</Trans>
            </Link>
            {canDelete ? (
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
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleted(run)}>
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
  const runCount = runs.length
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
      <DataTable table={table} empty={<Trans>No evaluation ran on this dataset yet.</Trans>} />
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
