import { useEffect } from "react"
import { Outlet, useParams } from "react-router-dom"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { useInitStore } from "@/common/hooks/use-init-store"
import { DashboardRoute } from "@/common/routes/DashboardRoute"
import { RouteNames } from "@/common/routes/helpers"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { ProjectRoute } from "@/common/routes/ProjectRoute"
import { useAppDispatch } from "@/common/store/hooks"
import { Dashboard } from "../components/Dashboard"
import { evaluationExtractionDatasetsActions } from "../features/evaluation-extraction-datasets/evaluation-extraction-datasets.slice"
import { evaluationExtractionRunsActions } from "../features/evaluation-extraction-runs/evaluation-extraction-runs.slice"
import { injectEvalSlices, resetEvalSlices } from "../store/slices"
import { EvalDashboardRoute } from "./EvalDashboardRoute"
import { EvaluationExtractionDatasetRoute } from "./EvaluationExtractionDatasetRoute"
import { EvaluationExtractionDatasetsRoute } from "./EvaluationExtractionDatasetsRoute"
import { EvaluationExtractionRunRoute } from "./EvaluationExtractionRunRoute"
import { buildEvalPath, EvalRouteNames } from "./helpers"

export const evalRoutes = {
  path: EvalRouteNames.HOME,
  element: <Outlet />,
  children: [
    {
      path: buildEvalPath(RouteNames.ORGANIZATION_DASHBOARD),
      element: (
        <DashboardRoute>
          {(user, _projects, _organization) => <EvalDashboardRoute user={user} />}
        </DashboardRoute>
      ),
      children: [
        {
          path: buildEvalPath(RouteNames.PROJECT),
          element: (
            <ProjectRoute>
              {() => (
                <RestrictedFeature feature="evaluation" returnNull={false}>
                  <ProjectRouteHandler />
                </RestrictedFeature>
              )}
            </ProjectRoute>
          ),
          children: [
            {
              path: buildEvalPath(EvalRouteNames.EXTRACTION),
              element: <EvaluationExtractionDatasetsRoute />,
              children: [
                {
                  path: buildEvalPath(EvalRouteNames.EXTRACTION_DATASET),
                  element: <EvaluationExtractionDatasetRoute />,
                  children: [
                    {
                      path: buildEvalPath(EvalRouteNames.EVALUATION_RUN),
                      element: <EvaluationExtractionRunRoute />,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

const useSetCurrentIds = () => {
  const dispatch = useAppDispatch()
  const params = useParams()
  useEffect(() => {
    const { datasetId, runId } = params
    dispatch(
      evaluationExtractionDatasetsActions.setCurrentDatasetId({ datasetId: datasetId || null }),
    )

    dispatch(evaluationExtractionRunsActions.setCurrentRunId({ runId: runId || null }))
  }, [dispatch, params])
}

function ProjectRouteHandler() {
  const { initDone } = useInitStore({
    inject: injectEvalSlices,
    reset: resetEvalSlices,
    condition: true,
  })
  useSetCurrentIds()
  if (initDone) return <Dashboard />
  return <LoadingRoute />
}
