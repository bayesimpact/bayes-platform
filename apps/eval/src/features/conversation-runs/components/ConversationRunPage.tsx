import {
  type AgentParamsDto,
  type ConversationRunParamsDto,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { EllipsisIcon, RotateCwIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { BackLink } from "@/components/shared/BackLink"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
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
import { isRunActive, scoreOf } from "../run-status"
import { RunResultsSection } from "./RunResultsSection"
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
          eyebrow={
            <Badge
              variant="outline"
              className="font-mono"
              title={run.id}
              aria-label={t`Run ${runId}`}
            >
              {runId}
            </Badge>
          }
          badge={
            <>
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
                <Trans>Agent and judge</Trans>
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
        <RunResultsSection status={run.status} results={results} />
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
