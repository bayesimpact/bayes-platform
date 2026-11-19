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
import { PanelSection } from "@/components/shared/PanelSection"
import { SidePanel } from "@/components/shared/SidePanel"
import { SidePanelToggle } from "@/components/shared/SidePanelToggle"
import { SplitPage } from "@/components/shared/SplitPage"
import { StatCard } from "@/components/shared/StatCard"
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
import { useSidePanel } from "@/hooks/use-side-panel"
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
  const cancelRun = useCancelConversationRun(runParams)
  const retryRun = useRetryConversationRun(runParams)
  const deleteRun = useDeleteConversationRun(runParams)
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const canUpdate = can(EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION)
  const canDelete = can(EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION)
  const table = useReactTable({
    data: results,
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
  const agentName =
    flattenEvaluationAgents(groups).find((candidate) => candidate.id === run.agentId)?.name ?? "–"
  const revision = run.agentSettings.revision
  const summary = run.summary
  const canRetry = canUpdate && (run.status === "failed" || (summary?.errors ?? 0) > 0) && !isActive
  return (
    <SplitPage
      panel={
        panel.isOpen ? (
          <SidePanel
            title={<Trans>What this run used</Trans>}
            onClose={panel.close}
            takesFocus={panel.takesFocus}
          >
            <div className="flex flex-col gap-4">
              <PanelSection
                title={<Trans comment="The agent a run asked, and its version">Agent</Trans>}
                description={
                  <Trans comment="The agent of a run and the version it asked">
                    {agentName}, version {revision}
                  </Trans>
                }
              >
                <dl className="flex flex-col gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <dt className="font-medium">
                      <Trans comment="The model of the agent in a run">Model</Trans>
                    </dt>
                    <dd className="font-mono text-xs">{run.agentSettings.model}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="font-medium">
                      <Trans comment="The instructions of the agent in a run">Instructions</Trans>
                    </dt>
                    <dd className="rounded-md border bg-muted/40 p-2 whitespace-pre-wrap wrap-anywhere">
                      {run.agentSettings.instructions}
                    </dd>
                  </div>
                </dl>
              </PanelSection>
              <PanelSection
                title={<Trans comment="The judge of a run: the model that graded it">Judge</Trans>}
                description={
                  <Trans>The model that graded each answer, and what it was told.</Trans>
                }
              >
                <dl className="flex flex-col gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <dt className="font-medium">
                      <Trans comment="The model of the judge of a run">Model</Trans>
                    </dt>
                    <dd className="font-mono text-xs">{run.judgeModel}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="font-medium">
                      <Trans comment="The instructions of the judge of a run">Instructions</Trans>
                    </dt>
                    <dd className="whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                      {run.judgeInstructions ?? <Trans>None</Trans>}
                    </dd>
                  </div>
                </dl>
              </PanelSection>
            </div>
          </SidePanel>
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
          badge={<RunStatusBadge status={run.status} />}
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
                    <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
                      <Trash2Icon aria-hidden />
                      <Trans comment="Deletes a run">Delete</Trans>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
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
