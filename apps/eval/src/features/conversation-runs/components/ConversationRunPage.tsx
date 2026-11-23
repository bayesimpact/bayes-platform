import {
  type AgentParamsDto,
  type ConversationRunParamsDto,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
  STUDIO_UI_READ_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { PageContainer } from "@/components/shared/PageContainer"
import { RunPageHeader } from "@/components/shared/RunPageHeader"
import { SplitPage } from "@/components/shared/SplitPage"
import { StatCard } from "@/components/shared/StatCard"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { useRunEndToasts } from "@/hooks/use-run-end-toasts"
import { useSidePanel } from "@/hooks/use-side-panel"
import { isRunActive } from "@/lib/run-status"
import {
  useCancelConversationRun,
  useDeleteConversationRun,
  useRetryConversationRun,
} from "../api/mutations"
import { conversationRunQueryOptions, conversationRunRecordsQueryOptions } from "../api/queries"
import type { ResultFilter } from "../result-filters"
import { scoreOf } from "../score"
import { RunResultsSection } from "./RunResultsSection"
import { RunSettingsPanel } from "./RunSettingsPanel"

export type ConversationRunPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  /** The dataset the run asked, and its name, for the way back. */
  dataset: { id: string; name: string }
  runParams: ConversationRunParamsDto
  /** The filter of the results the URL names. */
  resultFilter: string | undefined
  onResultFilterChange: (filter: ResultFilter) => void
}

/**
 * A run of an evaluation: where it stands, its figures and each record with the agent's answer and its score. It follows a run under way by itself.
 */
export function ConversationRunPage({
  agent,
  agentParams,
  dataset,
  runParams,
  resultFilter,
  onResultFilterChange,
}: ConversationRunPageProps) {
  const { i18n } = useLingui()
  const { data: run } = useSuspenseQuery(conversationRunQueryOptions(runParams))
  const isActive = isRunActive(run.status)
  const { data: results } = useSuspenseQuery(
    conversationRunRecordsQueryOptions(runParams, { isActive }),
  )
  const panel = useSidePanel()
  // The run itself: the loader found it among the agent's.
  useRunEndToasts([{ id: run.id, status: run.status, datasetName: dataset.name }])
  const cancelRun = useCancelConversationRun(runParams)
  const retryRun = useRetryConversationRun(runParams)
  const deleteRun = useDeleteConversationRun(runParams)
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const canUpdate = can(EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION)
  const canDelete = can(EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION)
  const datasetName = dataset.name
  const agentName = agent.name
  const revision = run.agentSettings.revision
  const summary = run.summary
  const hasErrors = (summary?.errors ?? 0) > 0
  const canRetry = canUpdate && (run.status === "failed" || hasErrors) && !isActive
  return (
    <SplitPage
      panel={
        panel.isOpen ? (
          <RunSettingsPanel
            run={run}
            agent={agent}
            canOpenStudio={can(STUDIO_UI_READ_PERMISSION)}
            agentParams={agentParams}
            onClose={panel.close}
            takesFocus={panel.takesFocus}
          />
        ) : null
      }
    >
      {/* The results have many columns, and long texts: the page takes all the width. */}
      <PageContainer isWide>
        <RunPageHeader
          agentParams={agentParams}
          datasetId={dataset.id}
          run={run}
          remainingCount={summary?.running ?? 0}
          description={
            <Trans comment="Under the title of a run: the dataset it asked and the agent's version">
              {datasetName} · {agentName}, version {revision}
            </Trans>
          }
          panel={{
            isOpen: panel.isOpen,
            onToggle: panel.toggle,
            label: <Trans>Agent and judge</Trans>,
          }}
          cancelRun={canUpdate ? cancelRun : null}
          retryRun={canRetry ? retryRun : null}
          deleteRun={canDelete ? deleteRun : null}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label={<Trans comment="The average score of a run">Average score</Trans>}
            value={summary?.averageScore == null ? "–" : scoreOf(summary.averageScore, i18n.locale)}
          />
          <StatCard
            label={<Trans comment="How many records of a run the judge graded">Graded</Trans>}
            value={summary ? `${i18n.number(summary.graded)} / ${i18n.number(summary.total)}` : "–"}
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
        <RunResultsSection
          run={run}
          results={results}
          filter={resultFilter}
          onFilterChange={onResultFilterChange}
        />
      </PageContainer>
    </SplitPage>
  )
}
