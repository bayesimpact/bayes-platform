import {
  type AgentParamsDto,
  type ConversationRunParamsDto,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { EllipsisIcon, RotateCwIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { BackLink } from "@/components/shared/BackLink"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DataTable } from "@/components/shared/DataTable"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { SidePanelToggle } from "@/components/shared/SidePanelToggle"
import { SplitPage } from "@/components/shared/SplitPage"
import { StatCard } from "@/components/shared/StatCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  type EvaluationAgent,
  flattenEvaluationAgents,
  hasProjectPermission,
  useEvaluationWorkspace,
} from "@/features/agents"
import { useSidePanel } from "@/hooks/use-side-panel"
import { durationOf, fullDateTimeOf } from "@/lib/format-time"
import { shortIdOf } from "@/lib/short-id"
import {
  useCancelConversationRun,
  useDeleteConversationRun,
  useRetryConversationRun,
} from "../api/mutations"
import { conversationRunQueryOptions, conversationRunRecordsQueryOptions } from "../api/queries"
import {
  filterResults,
  isResultFilter,
  RESULT_FILTER_LABELS,
  RESULT_FILTERS,
  type ResultFilter,
} from "../result-filters"
import { isRunActive, scoreOf } from "../run-status"
import { conversationRunRecordColumnsOf } from "./conversation-run-record-columns"
import { RunSettingsPanel } from "./RunSettingsPanel"
import { RunStatusBadge } from "./RunStatusBadge"

export type ConversationRunPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  /** The dataset the run asked, and its name, for the way back. */
  dataset: { id: string; name: string }
  runParams: ConversationRunParamsDto
}

/**
 * A run of an evaluation: where it stands, its figures and each record with the agent's answer and its score. It follows a run under way by itself.
 */
export function ConversationRunPage({
  agent,
  agentParams,
  dataset,
  runParams,
}: ConversationRunPageProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const navigate = useNavigate()
  const { data: run } = useSuspenseQuery(conversationRunQueryOptions(runParams))
  const isActive = isRunActive(run.status)
  const { data: results } = useSuspenseQuery(
    conversationRunRecordsQueryOptions(runParams, { isActive }),
  )
  const { groups } = useEvaluationWorkspace()
  const panel = useSidePanel()
  const [confirming, setConfirming] = useState<"cancel" | "delete" | null>(null)
  const [filter, setFilter] = useState<ResultFilter>("all")
  // The filters that keep something: a run with no error offers no Errors filter.
  const filters = RESULT_FILTERS.filter(
    (candidate) => candidate === "all" || filterResults(results, candidate).length > 0,
  )
  // A filter that keeps nothing any more, as a run under way moves on, gives way to All.
  const activeFilter = filters.includes(filter) ? filter : "all"
  const shown = filterResults(results, activeFilter)
  const cancelRun = useCancelConversationRun(runParams)
  const retryRun = useRetryConversationRun(runParams)
  const deleteRun = useDeleteConversationRun(runParams)
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const canUpdate = can(EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION)
  const canDelete = can(EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION)
  const table = useReactTable({
    data: shown,
    columns: conversationRunRecordColumnsOf({
      locale: i18n.locale,
      translate: (descriptor) => i18n._(descriptor),
    }),
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
  })
  const datasetRuns = {
    to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
    params: { ...agentParams, datasetId: dataset.id },
    search: { tab: "runs" },
  } as const
  const started = fullDateTimeOf(run.createdAt, i18n.locale)
  const datasetName = dataset.name
  const runAgent = flattenEvaluationAgents(groups).find((candidate) => candidate.id === run.agentId)
  const agentName = runAgent?.name ?? "–"
  const revision = run.agentSettings.revision
  const runId = shortIdOf(run.id)
  // From its creation to its last change: a run that is over changes no more.
  const took = durationOf(run.updatedAt - run.createdAt, i18n.locale)
  const summary = run.summary
  const hasErrors = (summary?.errors ?? 0) > 0
  const canRetry = canUpdate && (run.status === "failed" || (summary?.errors ?? 0) > 0) && !isActive
  return (
    <SplitPage
      panel={
        panel.isOpen ? (
          <RunSettingsPanel
            run={run}
            agent={{ name: agentName, type: runAgent?.type ?? agent.type }}
            agentParams={agentParams}
            onClose={panel.close}
            takesFocus={panel.takesFocus}
          />
        ) : null
      }
    >
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
          badge={
            <>
              <Badge
                variant="outline"
                className="font-mono"
                title={run.id}
                aria-label={t`Run ${runId}`}
              >
                {runId}
              </Badge>
              <RunStatusBadge status={run.status} />
              {isActive ? null : (
                <Badge variant="outline">
                  <Trans comment="How long a run took, such as: Took 2 min 5 sec">
                    Took {took}
                  </Trans>
                </Badge>
              )}
            </>
          }
          description={
            <Trans comment="Under the title of a run: the dataset it asked and the agent's version">
              {datasetName} · {agentName}, version {revision}
            </Trans>
          }
          actions={
            <>
              <SidePanelToggle isOpen={panel.isOpen} onToggle={panel.toggle}>
                <Trans>What this run used</Trans>
              </SidePanelToggle>
              {canUpdate && isActive ? (
                <Button variant="outline" onClick={() => setConfirming("cancel")}>
                  <Trans comment="Stops a run under way">Cancel the run</Trans>
                </Button>
              ) : null}
              {canRetry || canDelete ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="icon" aria-label={t`More actions`} />}
                  >
                    <EllipsisIcon aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canRetry ? (
                      <DropdownMenuItem
                        disabled={retryRun.isPending}
                        onClick={() =>
                          retryRun.mutate(run.id, {
                            onSuccess: () => toast.success(t`The run started again.`),
                            onError: () =>
                              toast.error(t`The run could not start again. Try again.`),
                          })
                        }
                      >
                        <RotateCwIcon aria-hidden />
                        <Trans comment="Asks again the records of a run that failed">Retry</Trans>
                      </DropdownMenuItem>
                    ) : null}
                    {canDelete ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setConfirming("delete")}
                      >
                        <Trash2Icon aria-hidden />
                        <Trans comment="Deletes a run">Delete</Trans>
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </>
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label={<Trans comment="The average score of a run">Average score</Trans>}
            value={summary?.averageScore == null ? "–" : scoreOf(summary.averageScore, i18n.locale)}
          />
          <StatCard
            label={<Trans comment="How many records of a run the judge graded">Graded</Trans>}
            value={summary ? `${summary.graded} / ${summary.total}` : "–"}
          />
          <StatCard
            // In red once a record failed: a run with no error keeps the color of the other figures.
            label={
              <span className={hasErrors ? "text-destructive" : undefined}>
                <Trans comment="How many records of a run an error stopped">Errors</Trans>
              </span>
            }
            value={
              <span className={hasErrors ? "text-destructive" : undefined}>
                {summary ? i18n.number(summary.errors) : "–"}
              </span>
            }
          />
        </div>
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              <Trans comment="The title of the records of a run">Results</Trans>
            </h2>
            {filters.length > 1 ? (
              <ToggleGroup
                aria-label={t({
                  message: "Filter the results",
                  comment: "The label of the filters of the table of a run's results",
                })}
                variant="outline"
                size="sm"
                spacing={0}
                value={[activeFilter]}
                // A toggle group lets every item go: the filter stays when the person clicks it again.
                onValueChange={(values) => {
                  const [next] = values
                  if (isResultFilter(next)) setFilter(next)
                }}
              >
                {filters.map((candidate) => {
                  const filterName = i18n._(RESULT_FILTER_LABELS[candidate])
                  const count = i18n.number(filterResults(results, candidate).length)
                  return (
                    <ToggleGroupItem key={candidate} value={candidate}>
                      <Trans comment="A filter of a run's results and how many it keeps, such as: Errors (1)">
                        {filterName} ({count})
                      </Trans>
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            ) : null}
          </div>
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
        </section>
        <ConfirmDialog
          isOpen={confirming === "cancel"}
          onOpenChange={(isOpen) => setConfirming(isOpen ? "cancel" : null)}
          title={<Trans>Cancel this run?</Trans>}
          description={
            <Trans>
              The records not asked yet stay without an answer. The answers already graded are kept.
            </Trans>
          }
          confirmLabel={<Trans comment="Stops a run under way">Cancel the run</Trans>}
          dismissLabel={
            <Trans comment="Gives up cancelling a run under way">Keep it running</Trans>
          }
          isDestructive
          isPending={cancelRun.isPending}
          onConfirm={() =>
            cancelRun.mutate(run.id, {
              onSuccess: () => {
                toast.success(t`The run was cancelled.`)
                setConfirming(null)
              },
              onError: () => toast.error(t`The run could not be cancelled. Try again.`),
            })
          }
        />
        <ConfirmDialog
          isOpen={confirming === "delete"}
          onOpenChange={(isOpen) => setConfirming(isOpen ? "delete" : null)}
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
    </SplitPage>
  )
}
