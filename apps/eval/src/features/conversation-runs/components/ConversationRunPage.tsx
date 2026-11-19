import {
  type AgentParamsDto,
  CONVERSATION_RUN_RECORDS_PAGE_SIZE,
  type ConversationRunParamsDto,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { EllipsisIcon, RotateCwIcon, SquareIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { BackLink } from "@/components/shared/BackLink"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { FoldingCard } from "@/components/shared/FoldingCard"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { TablePagination } from "@/components/shared/TablePagination"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  type EvaluationAgent,
  flattenEvaluationAgents,
  hasProjectPermission,
  useEvaluationWorkspace,
} from "@/features/agents"
import { fullDateTimeOf } from "@/lib/format-time"
import {
  useCancelConversationRun,
  useDeleteConversationRun,
  useRetryConversationRun,
} from "../api/mutations"
import { conversationRunQueryOptions, conversationRunRecordsQueryOptions } from "../api/queries"
import { isRunActive, scoreOf } from "../run-status"
import { conversationRunRecordColumnsOf } from "./conversation-run-record-columns"
import { RunStatusBadge } from "./RunStatusBadge"

export type ConversationRunPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  /** The dataset the run asked, and its name, for the way back. */
  dataset: { id: string; name: string }
  runParams: ConversationRunParamsDto
  /** The page of records shown, counted from 0. */
  page: number
}

/**
 * A run of an evaluation: where it stands, its figures, the version and the judge it used, and
 * each record with the agent's answer and its score. It follows a run under way by itself.
 */
export function ConversationRunPage({
  agent,
  agentParams,
  dataset,
  runParams,
  page,
}: ConversationRunPageProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const { data: run } = useSuspenseQuery(conversationRunQueryOptions(runParams))
  const isActive = isRunActive(run.status)
  const { data: results } = useSuspenseQuery(
    conversationRunRecordsQueryOptions(runParams, page, { isActive }),
  )
  const { groups } = useEvaluationWorkspace()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const cancelRun = useCancelConversationRun(runParams)
  const retryRun = useRetryConversationRun(runParams)
  const deleteRun = useDeleteConversationRun(runParams)
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const canUpdate = can(EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION)
  const canDelete = can(EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION)
  const table = useReactTable({
    data: results.records,
    columns: conversationRunRecordColumnsOf({
      locale: i18n.locale,
      translate: (descriptor) => i18n._(descriptor),
    }),
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
  })
  const runPage = {
    to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId",
    params: {
      ...agentParams,
      datasetId: dataset.id,
      runId: runParams.evaluationConversationRunId,
    },
  } as const
  const datasetRuns = {
    to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
    params: { ...agentParams, datasetId: dataset.id },
    search: { tab: "runs" },
  } as const
  const started = fullDateTimeOf(run.createdAt, i18n.locale)
  const datasetName = dataset.name
  const agentName =
    flattenEvaluationAgents(groups).find((candidate) => candidate.id === run.agentId)?.name ?? "–"
  const revision = run.agentSettings.revision
  const summary = run.summary
  const canRetry = canUpdate && (run.status === "failed" || (summary?.errors ?? 0) > 0) && !isActive
  return (
    <PageContainer>
      <PageHeader
        back={
          <BackLink {...datasetRuns}>
            <Trans comment="The link back from a run to the runs of its dataset">Runs</Trans>
          </BackLink>
        }
        title={
          <Trans comment="The title of a run's page, by when it started">Run of {started}</Trans>
        }
        badge={<RunStatusBadge status={run.status} />}
        description={
          <Trans comment="Under the title of a run: the dataset it asked and the agent's version">
            {datasetName} · {agentName}, version {revision}
          </Trans>
        }
        actions={
          <>
            {canUpdate && isActive ? (
              <Button
                variant="outline"
                disabled={cancelRun.isPending}
                onClick={() =>
                  cancelRun.mutate(run.id, {
                    onSuccess: () => toast.success(t`The run was cancelled.`),
                    onError: () => toast.error(t`The run could not be cancelled. Try again.`),
                  })
                }
              >
                <SquareIcon data-icon="inline-start" aria-hidden />
                <Trans comment="Stops a run under way">Cancel the run</Trans>
              </Button>
            ) : null}
            {canRetry ? (
              <Button
                variant="outline"
                disabled={retryRun.isPending}
                onClick={() =>
                  retryRun.mutate(run.id, {
                    onSuccess: () => toast.success(t`The run started again.`),
                    onError: () => toast.error(t`The run could not start again. Try again.`),
                  })
                }
              >
                <RotateCwIcon data-icon="inline-start" aria-hidden />
                <Trans comment="Asks again the records of a run that failed">Retry</Trans>
              </Button>
            ) : null}
            {canDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="icon" aria-label={t`More actions`} />}
                >
                  <EllipsisIcon aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setIsConfirmingDelete(true)}
                  >
                    <Trash2Icon aria-hidden />
                    <Trans comment="Deletes a run">Delete</Trans>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={<Trans comment="The average score of a run">Average score</Trans>}
          value={summary?.averageScore == null ? "–" : scoreOf(summary.averageScore, i18n.locale)}
        />
        <StatCard
          label={<Trans comment="How many records of a run the judge graded">Graded</Trans>}
          value={summary ? `${summary.graded} / ${summary.total}` : "–"}
        />
        <StatCard
          label={<Trans comment="How many records of a run an error stopped">Errors</Trans>}
          value={summary ? i18n.number(summary.errors) : "–"}
        />
        <StatCard
          label={<Trans comment="The model that graded a run">Judge model</Trans>}
          value={<span className="font-mono text-base">{run.judgeModel}</span>}
        />
      </div>
      <FoldingCard
        title={<Trans>What this run used</Trans>}
        description={
          <Trans>The agent's instructions and model at this version, and the judge's.</Trans>
        }
        isOpenAtFirst={false}
      >
        <dl className="flex flex-col gap-3 p-4 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="font-medium">
              <Trans comment="The model of the agent in a run">Agent's model</Trans>
            </dt>
            <dd className="font-mono text-xs">{run.agentSettings.model}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-medium">
              <Trans>Agent's instructions</Trans>
            </dt>
            <dd className="max-h-64 overflow-y-auto rounded-md border bg-muted/40 p-2 whitespace-pre-wrap wrap-anywhere">
              {run.agentSettings.instructions}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-medium">
              <Trans>Instructions for the judge</Trans>
            </dt>
            <dd className="whitespace-pre-wrap wrap-anywhere text-muted-foreground">
              {run.judgeInstructions ?? <Trans>None</Trans>}
            </dd>
          </div>
        </dl>
      </FoldingCard>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          <Trans comment="The title of the records of a run">Results</Trans>
        </h2>
        <DataTable
          table={table}
          empty={
            run.status === "failed" ? (
              <Trans>This run failed before it asked a record.</Trans>
            ) : (
              <Trans>This run has no record yet.</Trans>
            )
          }
        />
        <TablePagination
          page={page}
          pageSize={CONVERSATION_RUN_RECORDS_PAGE_SIZE}
          total={results.total}
          onPageChange={(nextPage) =>
            void navigate({ ...runPage, search: { page: nextPage === 0 ? undefined : nextPage } })
          }
        />
      </section>
      <ConfirmDialog
        isOpen={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={<Trans>Delete this run?</Trans>}
        description={<Trans>The run and its results are deleted for good.</Trans>}
        confirmLabel={<Trans>Delete</Trans>}
        isDestructive
        isPending={deleteRun.isPending}
        onConfirm={() =>
          deleteRun.mutate(run.id, {
            onSuccess: () => {
              toast.success(t`The run was deleted.`)
              void navigate(datasetRuns)
            },
            onError: () => toast.error(t`The run could not be deleted. Try again.`),
          })
        }
      />
    </PageContainer>
  )
}
