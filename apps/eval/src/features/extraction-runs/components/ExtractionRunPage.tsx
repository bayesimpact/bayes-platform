import {
  type AgentParamsDto,
  EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
  type ExtractionDatasetOutputDto,
  type ExtractionRunParamsDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { PageContainer } from "@/components/shared/PageContainer"
import { RunPageHeader } from "@/components/shared/RunPageHeader"
import { SplitPage } from "@/components/shared/SplitPage"
import { StatCard } from "@/components/shared/StatCard"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { useSidePanel } from "@/hooks/use-side-panel"
import { isRunActive } from "@/lib/run-status"
import { openBlankTab } from "@/lib/safe-url"
import {
  useCancelExtractionRun,
  useDeleteExtractionRun,
  useOpenRunCsv,
  useRetryExtractionRun,
} from "../api/mutations"
import { extractionRunQueryOptions, extractionRunRecordsQueryOptions } from "../api/queries"
import { matchRateOf, percentOf } from "../match-rate"
import { ExtractionResultsSection } from "./ExtractionResultsSection"
import { ExtractionRunPanel } from "./ExtractionRunPanel"

export type ExtractionRunPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  /** The dataset the run asked: its name, for the way back, and its columns. */
  dataset: ExtractionDatasetOutputDto
  runParams: ExtractionRunParamsDto
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
}: ExtractionRunPageProps) {
  const { t, i18n } = useLingui()
  const { data: run } = useSuspenseQuery(extractionRunQueryOptions(runParams))
  const isActive = isRunActive(run.status)
  const { data: results } = useSuspenseQuery(
    extractionRunRecordsQueryOptions(runParams, { isActive }),
  )
  const panel = useSidePanel()
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
            onClose={panel.close}
            takesFocus={panel.takesFocus}
          />
        ) : null
      }
    >
      <PageContainer>
        <RunPageHeader
          agentParams={agentParams}
          datasetId={dataset.id}
          run={run}
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
          menuItems={
            csvDocumentId ? (
              <DropdownMenuItem
                onClick={() =>
                  openCsv.mutate(
                    { documentId: csvDocumentId, tab: openBlankTab() },
                    { onError: () => toast.error(t`The CSV file could not be opened. Try again.`) },
                  )
                }
              >
                <DownloadIcon aria-hidden />
                <Trans comment="Opens the results of a run as a CSV file">Download CSV</Trans>
              </DropdownMenuItem>
            ) : null
          }
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
            value={summary ? `${summary.perfectMatches} / ${summary.total}` : "–"}
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
        <ExtractionResultsSection run={run} dataset={dataset} results={results} />
      </PageContainer>
    </SplitPage>
  )
}
