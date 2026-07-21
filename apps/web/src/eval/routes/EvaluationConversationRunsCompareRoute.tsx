import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  selectCurrentConversationDatasetData,
  selectCurrentConversationDatasetId,
} from "../features/evaluation-conversation-datasets/evaluation-conversation-datasets.selectors"
import { EvaluationConversationRunsComparison } from "../features/evaluation-conversation-runs/components/EvaluationConversationRunsComparison"
import {
  selectConversationRunsComparison,
  selectConversationRunsData,
} from "../features/evaluation-conversation-runs/evaluation-conversation-runs.selectors"
import { evaluationConversationRunsActions } from "../features/evaluation-conversation-runs/evaluation-conversation-runs.slice"
import { EvalRoutes } from "./helpers"

function useCompareRunIds(): string[] {
  const [searchParams] = useSearchParams()
  const runsParam = searchParams.get("runs") ?? ""
  return useMemo(() => runsParam.split(",").filter(Boolean), [runsParam])
}

export function EvaluationConversationRunsCompareRoute() {
  const datasetId = useCurrentId(selectCurrentConversationDatasetId)
  const dataset = useAppSelector(selectCurrentConversationDatasetData)
  const runs = useAppSelector(selectConversationRunsData)
  const comparison = useAppSelector(selectConversationRunsComparison)
  const dispatch = useAppDispatch()
  const runIds = useCompareRunIds()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const runIdsKey = runIds.join(",")

  // URL-driven id setting (same role as useSetCurrentIds, ADR 0009); declared
  // before useMount so the ids are in the store when compareMount fires.
  useEffect(() => {
    dispatch(evaluationConversationRunsActions.setComparisonRunIds(runIds))
  }, [dispatch, runIds])

  useMount({
    actions: {
      mount: evaluationConversationRunsActions.compareMount,
      unmount: evaluationConversationRunsActions.compareUnmount,
    },
    condition: runIds.length > 0,
    refreshOn: [runIdsKey],
  })

  const parentPath = EvalRoutes.conversationDataset.build({
    organizationId,
    projectId,
    datasetId,
  })

  if (!datasetId) return <LoadingRoute />
  if (runIds.length === 0) return <Navigate to={parentPath} replace />
  return (
    <AsyncRoute data={[dataset, runs, comparison]}>
      <WithData runIds={runIds} />
    </AsyncRoute>
  )
}

function WithData({ runIds }: { runIds: string[] }) {
  const { t } = useTranslation()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const dataset = useValue(selectCurrentConversationDatasetData)
  const allRuns = useValue(selectConversationRunsData)
  const recordsByRunId = useValue(selectConversationRunsComparison)
  const navigate = useNavigate()

  // Preserve the order the user selected the runs in.
  const runs = useMemo(
    () =>
      runIds
        .map((runId) => allRuns.find((run) => run.id === runId))
        .filter((run) => run !== undefined),
    [runIds, allRuns],
  )

  const handleBack = () =>
    navigate(
      EvalRoutes.conversationDataset.build({ organizationId, projectId, datasetId: dataset.id }),
    )

  return (
    <div>
      <GridHeader
        title={t("evaluationConversationRun:comparison.title")}
        description={t("evaluationConversationRun:comparison.description", { count: runs.length })}
        onBack={handleBack}
      />
      <div className="p-6">
        {runs.length === 0 ? (
          <p className="text-muted-foreground">
            {t("evaluationConversationRun:comparison.notFound")}
          </p>
        ) : (
          <EvaluationConversationRunsComparison runs={runs} recordsByRunId={recordsByRunId} />
        )}
      </div>
    </div>
  )
}
