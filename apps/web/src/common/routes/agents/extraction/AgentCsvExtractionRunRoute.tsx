import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { useSidebar } from "@caseai-connect/ui/shad/sidebar"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { AlertCircleIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridHeader } from "@/common/components/grid/Grid"
import {
  selectCurrentCsvRunData,
  selectCurrentCsvRunId,
  selectIsCancellingCsvRun,
  selectIsRetryingCsvRun,
} from "@/common/features/agents/csv-extraction-runs/agent-csv-extraction-runs.selectors"
import { agentCsvExtractionRunsActions } from "@/common/features/agents/csv-extraction-runs/agent-csv-extraction-runs.slice"
import { AgentCsvExtractionRunRecordsTable } from "@/common/features/agents/csv-extraction-runs/components/AgentCsvExtractionRunRecordsTable"
import { AgentCsvExtractionRunStatusBadge } from "@/common/features/agents/csv-extraction-runs/components/AgentCsvExtractionRunStatusBadge"
import { AgentCsvExtractionRunSummary } from "@/common/features/agents/csv-extraction-runs/components/AgentCsvExtractionRunSummaryCard"
import { useGetAgentRoute } from "@/common/hooks/use-get-path"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDuration, buildSince } from "@/common/utils/build-date"
import { DocumentOpener } from "@/studio/features/documents/components/DocumentOpener"

export function AgentCsvExtractionRunRoute() {
  const runData = useAppSelector(selectCurrentCsvRunData)
  const runId = useAppSelector(selectCurrentCsvRunId)
  const { setOpen, open } = useSidebar()

  useEffect(() => {
    setOpen(false)
    return () => setOpen(true)
  }, [setOpen])

  useMount({ actions: agentCsvExtractionRunsActions, condition: !!runId && !open })

  if (!runId) return <LoadingRoute />
  return (
    <AsyncRoute data={[runData]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const navigate = useNavigate()
  const run = useValue(selectCurrentCsvRunData)
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const isCancelling = useAppSelector(selectIsCancellingCsvRun)
  const isRetrying = useAppSelector(selectIsRetryingCsvRun)
  const agentPath = useGetAgentRoute()

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const handleBack = () => navigate(agentPath)

  const canCancel = run.status === "pending" || run.status === "running"
  const canRetry = run.status === "failed"
  const isFinished =
    run.status === "completed" || run.status === "failed" || run.status === "cancelled"

  const handleCancel = () => {
    dispatch(
      agentCsvExtractionRunsActions.cancelOne({
        agentId: run.agentId,
        agentCsvExtractionRunId: run.id,
      }),
    )
  }

  const handleRetry = () => {
    dispatch(
      agentCsvExtractionRunsActions.retryOne({
        agentId: run.agentId,
        agentCsvExtractionRunId: run.id,
      }),
    )
  }

  const handleDelete = () => {
    dispatch(agentCsvExtractionRunsActions.deleteOne({ agentCsvExtractionRunId: run.id }))
    setConfirmDeleteOpen(false)
    handleBack()
  }

  return (
    <div>
      <GridHeader
        title={t("agentCsvExtractionRun:results.title")}
        description={
          <div className="flex flex-col gap-2">
            {buildSince(run.updatedAt)}
            <div className="flex gap-2">
              <AgentCsvExtractionRunStatusBadge status={run.status} />
              {isFinished && (
                <Badge variant="secondary">
                  {t("agentCsvExtractionRun:results.duration", {
                    duration: buildDuration(run.createdAt, run.updatedAt),
                  })}
                </Badge>
              )}
              {run.summary && run.summary.running > 0 && (
                <Badge variant="secondary">
                  {canCancel ? <Spinner /> : <AlertCircleIcon />}
                  {t("agentCsvExtractionRun:results.remaining", { count: run.summary.running })}
                </Badge>
              )}
            </div>
          </div>
        }
        onBack={handleBack}
        action={
          <>
            {canCancel ? (
              <Button variant="outline" onClick={handleCancel} disabled={isCancelling}>
                {t("agentCsvExtractionRun:results.cancel")}
              </Button>
            ) : canRetry ? (
              <Button variant="outline" onClick={handleRetry} disabled={isRetrying}>
                {t("agentCsvExtractionRun:results.retry")}
              </Button>
            ) : run.csvExportDocumentId ? (
              <DocumentOpener documentId={run.csvExportDocumentId} />
            ) : null}

            <Button variant="secondary" size="icon" onClick={() => setConfirmDeleteOpen(true)}>
              <Trash2Icon />
            </Button>
          </>
        }
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        title={t("agentCsvExtractionRun:delete.confirm.title")}
        description={t("agentCsvExtractionRun:delete.confirm.description")}
        confirmLabel={t("agentCsvExtractionRun:delete.confirm.submit")}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
      <div className="p-6 flex flex-col gap-6">
        <AgentCsvExtractionRunSummary run={run} />
        <AgentCsvExtractionRunRecordsTable run={run} />
      </div>
    </div>
  )
}
