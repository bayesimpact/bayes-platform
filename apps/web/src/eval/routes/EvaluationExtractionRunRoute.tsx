import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { AlertCircleIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import { DocumentOpener } from "@/studio/features/documents/components/DocumentOpener"
import { selectCurrentDatasetData } from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.selectors"
import { AgentMetadataDialog } from "../features/evaluation-extraction-runs/components/AgentMetadataDialog"
import { DeleteEvaluationExtractionRunButton } from "../features/evaluation-extraction-runs/components/DeleteEvaluationExtractionRunButton"
import { EvaluationExtractionRunRecordsTable } from "../features/evaluation-extraction-runs/components/EvaluationExtractionRunResults"
import { EvaluationExtractionRunSummary } from "../features/evaluation-extraction-runs/components/EvaluationExtractionRunSummary"
import { RunStatusBadge } from "../features/evaluation-extraction-runs/components/RunStatusBadge"
import {
  selectCurrentRunData,
  selectCurrentRunId,
  selectIsCancelling,
  selectIsRetrying,
} from "../features/evaluation-extraction-runs/evaluation-extraction-runs.selectors"
import { evaluationExtractionRunsActions } from "../features/evaluation-extraction-runs/evaluation-extraction-runs.slice"
import { EvalRoutes } from "./helpers"

export function EvaluationExtractionRunRoute() {
  const runId = useAppSelector(selectCurrentRunId)
  const runData = useAppSelector(selectCurrentRunData)
  const datasetData = useAppSelector(selectCurrentDatasetData)

  useMount({ actions: evaluationExtractionRunsActions, condition: !!runId })

  if (!runId) return <LoadingRoute />
  return (
    <AsyncRoute data={[runData, datasetData]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const run = useValue(selectCurrentRunData)
  const dataset = useValue(selectCurrentDatasetData)
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const isCancelling = useAppSelector(selectIsCancelling)
  const isRetrying = useAppSelector(selectIsRetrying)

  const handleBack = () =>
    navigate(
      EvalRoutes.extractionDataset.build({ organizationId, projectId, datasetId: dataset.id }),
    )

  const canCancel = run.status === "pending" || run.status === "running"
  const canRetry = run.status === "failed"
  const handleCancel = () => {
    dispatch(evaluationExtractionRunsActions.cancelOne({ evaluationExtractionRunId: run.id }))
  }

  const handleRetry = () => {
    dispatch(evaluationExtractionRunsActions.retryOne({ evaluationExtractionRunId: run.id }))
  }
  return (
    <div>
      <GridHeader
        title={t("evaluationExtractionRun:results.title")}
        description={
          <div className="flex flex-col gap-2">
            {buildSince(run.createdAt)}

            <div className="flex gap-2">
              <RunStatusBadge status={run.status} />

              {run.summary && run.summary.running > 0 && (
                <Badge variant="secondary">
                  {canCancel ? <Spinner /> : <AlertCircleIcon />}
                  {t("evaluationExtractionRun:results.remaining", { count: run.summary.running })}
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
                {t("evaluationExtractionRun:results.cancel")}
              </Button>
            ) : run.csvExportDocumentId ? (
              <DocumentOpener documentId={run.csvExportDocumentId} />
            ) : canRetry ? (
              <Button variant="outline" onClick={handleRetry} disabled={isRetrying}>
                {t("evaluationExtractionRun:results.retry")}
              </Button>
            ) : null}

            <AgentMetadataDialog
              buttonProps={{ variant: "outline", size: "sm" }}
              agentId={run.agentId}
            />
            <DeleteEvaluationExtractionRunButton
              buttonProps={{ variant: "secondary", size: "icon" }}
              runId={run.id}
              onDelete={handleBack}
            />
          </>
        }
      />
      <div className="p-6 flex flex-col gap-6">
        <EvaluationExtractionRunSummary run={run} />
        <EvaluationExtractionRunRecordsTable run={run} dataset={dataset} />
      </div>
    </div>
  )
}
