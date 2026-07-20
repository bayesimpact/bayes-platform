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
import { buildDuration, buildSince } from "@/common/utils/build-date"
import { selectCurrentConversationDatasetData } from "../features/evaluation-conversation-datasets/evaluation-conversation-datasets.selectors"
import { AgentMetadataDialog } from "../features/evaluation-conversation-runs/components/AgentMetadataDialog"
import { DeleteEvaluationConversationRunButton } from "../features/evaluation-conversation-runs/components/DeleteEvaluationConversationRunButton"
import { EvaluationConversationRunRecordsTable } from "../features/evaluation-conversation-runs/components/EvaluationConversationRunResults"
import { EvaluationConversationRunSummary } from "../features/evaluation-conversation-runs/components/EvaluationConversationRunSummary"
import { RunStatusBadge } from "../features/evaluation-conversation-runs/components/RunStatusBadge"
import {
  selectCurrentConversationRunData,
  selectCurrentConversationRunId,
  selectIsCancellingConversationRun,
  selectIsRetryingConversationRun,
} from "../features/evaluation-conversation-runs/evaluation-conversation-runs.selectors"
import { evaluationConversationRunsActions } from "../features/evaluation-conversation-runs/evaluation-conversation-runs.slice"
import { EvalRoutes } from "./helpers"

export function EvaluationConversationRunRoute() {
  const runId = useAppSelector(selectCurrentConversationRunId)
  const runData = useAppSelector(selectCurrentConversationRunData)
  const datasetData = useAppSelector(selectCurrentConversationDatasetData)

  useMount({ actions: evaluationConversationRunsActions, condition: !!runId })

  if (!runId) return <LoadingRoute />
  return (
    <AsyncRoute data={[runData, datasetData]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const run = useValue(selectCurrentConversationRunData)
  const dataset = useValue(selectCurrentConversationDatasetData)
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const isCancelling = useAppSelector(selectIsCancellingConversationRun)
  const isRetrying = useAppSelector(selectIsRetryingConversationRun)

  const handleBack = () =>
    navigate(
      EvalRoutes.conversationDataset.build({ organizationId, projectId, datasetId: dataset.id }),
    )

  const canCancel = run.status === "pending" || run.status === "running"
  const canRetry = run.status === "failed"
  const isFinished =
    run.status === "completed" || run.status === "failed" || run.status === "cancelled"
  const handleCancel = () => {
    dispatch(evaluationConversationRunsActions.cancelOne({ evaluationConversationRunId: run.id }))
  }

  const handleRetry = () => {
    dispatch(evaluationConversationRunsActions.retryOne({ evaluationConversationRunId: run.id }))
  }
  return (
    <div>
      <GridHeader
        title={t("evaluationConversationRun:results.title")}
        description={
          <div className="flex flex-col gap-2">
            {buildSince(run.updatedAt)}

            <div className="flex gap-2">
              <RunStatusBadge status={run.status} />
              {isFinished && (
                <Badge variant="secondary">
                  {t("evaluationConversationRun:results.duration", {
                    duration: buildDuration(run.createdAt, run.updatedAt),
                  })}
                </Badge>
              )}

              {run.summary && run.summary.running > 0 && (
                <Badge variant="secondary">
                  {canCancel ? <Spinner /> : <AlertCircleIcon />}
                  {t("evaluationConversationRun:results.remaining", { count: run.summary.running })}
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
                {t("evaluationConversationRun:results.cancel")}
              </Button>
            ) : canRetry ? (
              <Button variant="outline" onClick={handleRetry} disabled={isRetrying}>
                {t("evaluationConversationRun:results.retry")}
              </Button>
            ) : null}

            <AgentMetadataDialog
              buttonProps={{ variant: "outline", size: "sm" }}
              agentId={run.agentId}
            />
            <DeleteEvaluationConversationRunButton
              buttonProps={{ variant: "secondary", size: "icon" }}
              runId={run.id}
              onDelete={handleBack}
            />
          </>
        }
      />
      <div className="p-6 flex flex-col gap-6">
        <EvaluationConversationRunSummary run={run} />
        <EvaluationConversationRunRecordsTable run={run} />
      </div>
    </div>
  )
}
