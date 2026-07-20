import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { OrganizationRoute } from "@/common/routes/OrganizationRoute"
import { ProjectRoute } from "@/common/routes/ProjectRoute"
import { Dashboard } from "../components/Dashboard"
import { EvalLayout } from "../components/EvalLayout"
import { EvalRoute } from "./EvalRoute"
import { EvaluationConversationDatasetRoute } from "./EvaluationConversationDatasetRoute"
import { EvaluationConversationDatasetsRoute } from "./EvaluationConversationDatasetsRoute"
import { EvaluationConversationRunRoute } from "./EvaluationConversationRunRoute"
import { EvaluationExtractionDatasetRoute } from "./EvaluationExtractionDatasetRoute"
import { EvaluationExtractionDatasetsRoute } from "./EvaluationExtractionDatasetsRoute"
import { EvaluationExtractionRunRoute } from "./EvaluationExtractionRunRoute"
import { EvalRoutes } from "./helpers"

export const evalRoutes = {
  path: EvalRoutes.home.path,
  element: <EvalRoute />,
  children: [
    {
      path: EvalRoutes.project.path,
      element: (
        <OrganizationRoute>
          <ProjectRoute>
            <EvalLayout>
              <RestrictedFeature feature="evaluation" returnNull={false}>
                <Dashboard />
              </RestrictedFeature>
            </EvalLayout>
          </ProjectRoute>
        </OrganizationRoute>
      ),
      children: [
        {
          path: EvalRoutes.extraction.path,
          element: <EvaluationExtractionDatasetsRoute />,
          children: [
            {
              path: EvalRoutes.extractionDataset.path,
              element: <EvaluationExtractionDatasetRoute />,
              children: [
                {
                  path: EvalRoutes.evaluationRun.path,
                  element: <EvaluationExtractionRunRoute />,
                },
              ],
            },
          ],
        },
        {
          path: EvalRoutes.conversation.path,
          element: <EvaluationConversationDatasetsRoute />,
          children: [
            {
              path: EvalRoutes.conversationDataset.path,
              element: <EvaluationConversationDatasetRoute />,
              children: [
                {
                  path: EvalRoutes.conversationRun.path,
                  element: <EvaluationConversationRunRoute />,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
