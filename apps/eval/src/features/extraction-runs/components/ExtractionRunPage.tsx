import {
  type AgentParamsDto,
  EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
  type ExtractionDatasetOutputDto,
  type ExtractionRunParamsDto,
  STUDIO_UI_READ_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { openBlankTab } from "@caseai-connect/frontend-lib"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { PageContainer } from "@/components/shared/PageContainer"
import { RunPageHeader } from "@/components/shared/RunPageHeader"
import { SplitPage } from "@/components/shared/SplitPage"
import { StatCard } from "@/components/shared/StatCard"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { useRunEndToasts } from "@/hooks/use-run-end-toasts"
import { useSidePanel } from "@/hooks/use-side-panel"
import type { RunSearch } from "@/lib/run-search"
import { isRunActive } from "@/lib/run-status"
import {
  useCancelExtractionRun,
  useDeleteExtractionRun,
  useOpenRunCsv,
  useRetryExtractionRun,
} from "../api/mutations"
import { extractionRunQueryOptions } from "../api/queries"
import { matchRateOf, percentOf } from "../match-rate"
import { ExtractionResultsSection } from "./ExtractionResultsSection"
import { ExtractionRunPanel } from "./ExtractionRunPanel"

export type ExtractionRunPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  /** The dataset the run asked: its name, for the way back, and its columns. */
  dataset: ExtractionDatasetOutputDto
  runParams: ExtractionRunParamsDto
  /** Which results show: the page, the order, the search and the filter, from the URL. */
  search: RunSearch
  onSearchChange: (search: RunSearch) => void
}

/**
 * A run of an evaluation of an extraction agent: where it stands, its figures and each record
 * with the fields the agent returned beside the values expected. It follows a run under way by
 * itself.
 */
export function ExtractionRunPage({
  agent,
  agentParams,
  dataset,
  runParams,
  search,
  onSearchChange,
}: ExtractionRunPageProps) {
  const { t, i18n } = useLingui()
  const { data: run } = useSuspenseQuery(extractionRunQueryOptions(runParams))
  const isActive = isRunActive(run.status)
  const panel = useSidePanel()
  // The run itself: the loader found it among the agent's.
  useRunEndToasts([{ id: run.id, status: run.status, datasetName: dataset.name }])
  const cancelRun = useCancelExtractionRun(runParams)
  const retryRun = useRetryExtractionRun(runParams)
  const deleteRun = useDeleteExtractionRun(runParams)
  const openCsv = useOpenRunCsv(runParams)
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const canUpdate = can(EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION)
  const datasetName = dataset.name
  const agentName = agent.name
  const revision = run.agentRevision
  const summary = run.summary
  const matchRate = matchRateOf(summary)
  const hasErrors = (summary?.errors ?? 0) > 0
  const canRetry = canUpdate && (run.status === "failed" || hasErrors) && !isActive
  const csvDocumentId = run.csvExportDocumentId
  return (
    <SplitPage
      panel={
        panel.isOpen ? (
          <ExtractionRunPanel
            run={run}
            dataset={dataset}
            agent={agent}
            agentParams={agentParams}
            canOpenStudio={can(STUDIO_UI_READ_PERMISSION)}
            onClose={panel.close}
            takesFocus={panel.takesFocus}
          />
        ) : null
      }
    >
      {/* The results have columns for each input and each field. */}
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
            label: <Trans>Agent and fields</Trans>,
          }}
          cancelRun={canUpdate ? cancelRun : null}
          retryRun={canRetry ? retryRun : null}
          deleteRun={can(EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION) ? deleteRun : null}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={
              <Trans comment="The share of a run's records that match on every compared field">
                Match rate
              </Trans>
            }
            value={matchRate === null ? "–" : percentOf(matchRate, i18n.locale)}
          />
          <StatCard
            label={
              <Trans comment="How many records of a run match on every compared field">
                Matches
              </Trans>
            }
            value={
              summary
                ? `${i18n.number(summary.perfectMatches)} / ${i18n.number(summary.total)}`
                : "–"
            }
          />
          <StatCard
            label={
              <Trans comment="How many records of a run have a field that differs from the value expected">
                Mismatches
              </Trans>
            }
            value={summary ? i18n.number(summary.mismatches) : "–"}
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
        <ExtractionResultsSection
          run={run}
          runParams={runParams}
          dataset={dataset}
          search={search}
          onSearchChange={onSearchChange}
          onDownloadCsv={
            csvDocumentId
              ? () =>
                  openCsv.mutate(
                    { documentId: csvDocumentId, tab: openBlankTab() },
                    { onError: () => toast.error(t`The CSV file could not be opened. Try again.`) },
                  )
              : null
          }
        />
      </PageContainer>
    </SplitPage>
  )
}
