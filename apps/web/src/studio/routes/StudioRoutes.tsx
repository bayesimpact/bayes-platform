import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { AgentRoute } from "@/common/routes/AgentRoute"
import { AgentSessionRoute } from "@/common/routes/agents/AgentSessionRoute"
import { ConversationAgentSessionsRoute } from "@/common/routes/agents/ConversationAgentSessionsRoute"
import { ExtractionAgentSessionsRoute } from "@/common/routes/agents/ExtractionAgentSessionsRoute"
import { AgentCsvExtractionRunRoute } from "@/common/routes/agents/extraction/AgentCsvExtractionRunRoute"
import { AgentExtractionRoute } from "@/common/routes/agents/extraction/AgentExtractionRoute"
import { FormAgentSessionsRoute } from "@/common/routes/agents/FormAgentSessionsRoute"
import { RoutesBuilderProvider } from "@/common/routes/build-routes/RoutesBuilderProvider"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { OrganizationRoute } from "@/common/routes/OrganizationRoute"
import { ProjectRoute } from "@/common/routes/ProjectRoute"
import {
  ConversationAgentSessionList,
  ExtractionAgentSessionList,
  FormAgentSessionList,
} from "@/studio/features/agents/components/AgentSessionList"
import { CampaignsRoute } from "@/studio/routes/CampaignsRoute"
import { ProjectAdminRoute } from "@/studio/routes/ProjectAdminRoute"
import { StudioLayout } from "../components/StudioLayout"
import { AgentList } from "../features/analytics/agent/components/AgentList"
import { AgentAnalyticsRoute } from "./AgentAnalyticsRoute"
import { AgentEditorRoute } from "./AgentEditorRoute"
import { AgentMembershipsRoute } from "./AgentMembershipsRoute"
import { ProjectDocumentsRoute } from "./DocumentsRoute"
import { EvaluationRoute } from "./EvaluationRoute"
import { FeedbackRoute } from "./FeedbackRoute"
import { StudioRoutes } from "./helpers"
import { ProjectAnalyticsRoute } from "./ProjectAnalyticsRoute"
import { ProjectMembershipRoute } from "./ProjectMembershipRoute"
import { ProjectMembershipsRoute } from "./ProjectMembershipsRoute"
import { ResourceCreatorRoute } from "./ResourceCreatorRoute"
import { ResourceEditorRoute } from "./ResourceEditorRoute"
import { ResourceLibrariesRoute } from "./ResourceLibrariesRoute"
import { ResourceLibraryCreatorRoute } from "./ResourceLibraryCreatorRoute"
import { ResourceLibraryEditorRoute } from "./ResourceLibraryEditorRoute"
import { RestrictedAccess } from "./RestrictedAccess"
import { ReviewCampaignReportRoute } from "./ReviewCampaignReportRoute"
import { StudioAgentSessionRoute } from "./StudioAgentSessionRoute"
import { StudioRoute } from "./StudioRoute"
import { WebSourcesRoute } from "./WebSourcesRoute"

export const studioRoutes = {
  path: StudioRoutes.home.path,
  element: <StudioRoute />,
  children: [
    {
      path: StudioRoutes.project.path,
      element: (
        <OrganizationRoute>
          <ProjectRoute>
            <RoutesBuilderProvider
              build={{
                agentRoute: StudioRoutes.agent.build,
                agentSessionRoute: StudioRoutes.agentSession.build,
                agentExtractionCsvRunRoute: StudioRoutes.agentExtractionCsvRun.build,
                projectRoute: StudioRoutes.project.build,
              }}
            >
              <StudioLayout>
                <AgentList />
              </StudioLayout>
            </RoutesBuilderProvider>
          </ProjectRoute>
        </OrganizationRoute>
      ),
      children: [
        {
          path: StudioRoutes.evaluation.path,
          element: (
            <RestrictedFeature feature="evaluation" returnNull={false}>
              <EvaluationRoute />
            </RestrictedFeature>
          ),
        },
        {
          path: StudioRoutes.documents.path,
          element: <ProjectDocumentsRoute />,
        },
        {
          path: StudioRoutes.webSources.path,
          element: (
            <RestrictedFeature feature="web-sources">
              <WebSourcesRoute />
            </RestrictedFeature>
          ),
        },
        {
          path: StudioRoutes.resourceLibraries.path,
          element: <ResourceLibrariesRoute />,
          children: [
            {
              path: StudioRoutes.resourceLibraryNew.path,
              element: <ResourceLibraryCreatorRoute />,
            },
            {
              path: StudioRoutes.resourceLibrary.path,
              element: <ResourceLibraryEditorRoute />,
              children: [
                {
                  path: StudioRoutes.resourceNew.path,
                  element: <ResourceCreatorRoute />,
                },
                {
                  path: StudioRoutes.resource.path,
                  element: <ResourceEditorRoute />,
                },
              ],
            },
          ],
        },
        {
          path: StudioRoutes.projectAnalytics.path,
          element: (
            <RestrictedFeature feature="project-analytics" returnNull={false}>
              <ProjectAnalyticsRoute />
            </RestrictedFeature>
          ),
        },
        {
          path: StudioRoutes.projectMemberships.path,
          element: <ProjectMembershipsRoute />,
          children: [
            {
              path: StudioRoutes.projectMembership.path,
              element: <ProjectMembershipRoute />,
            },
          ],
        },
        {
          path: StudioRoutes.projectAdmin.path,
          element: <ProjectAdminRoute />,
        },
        {
          path: StudioRoutes.reviewCampaigns.path,
          element: <CampaignsRoute />,
        },
        {
          path: StudioRoutes.reviewCampaignReport.path,
          element: <ReviewCampaignReportRoute />,
        },
        {
          path: StudioRoutes.agent.path,
          element: (
            <AgentRoute>
              <AgentSessionsHandler />
            </AgentRoute>
          ),
          children: [
            {
              path: StudioRoutes.agentSession.path,
              element: <AgentSessionRoute Component={StudioAgentSessionRoute} />,
            },

            {
              path: StudioRoutes.agentExtraction.path,
              element: (
                <AgentExtractionRoute buildCsvRunPath={StudioRoutes.agentExtractionCsvRun.build} />
              ),
              children: [
                {
                  path: StudioRoutes.agentExtractionCsvRun.path,
                  element: <AgentCsvExtractionRunRoute />,
                },
              ],
            },
            {
              element: <RestrictedAccess ability="canManageAgent" />,
              children: [
                {
                  path: StudioRoutes.agentEdit.path,
                  element: <AgentEditorRoute />,
                },
                {
                  path: StudioRoutes.agentAnalytics.path,
                  element: (
                    <RestrictedFeature feature="project-analytics">
                      <AgentAnalyticsRoute />
                    </RestrictedFeature>
                  ),
                },
                {
                  path: StudioRoutes.feedback.path,
                  element: <FeedbackRoute />,
                },
                {
                  path: StudioRoutes.agentMemberships.path,
                  element: <AgentMembershipsRoute />,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

function AgentSessionsHandler() {
  const agent = useValue(selectCurrentAgentData)
  switch (agent.type) {
    case "conversation":
      return (
        <ConversationAgentSessionsRoute>
          <ConversationAgentSessionList />
        </ConversationAgentSessionsRoute>
      )
    case "form":
      return (
        <FormAgentSessionsRoute>
          <FormAgentSessionList />
        </FormAgentSessionsRoute>
      )
    case "extraction":
      return (
        <ExtractionAgentSessionsRoute>
          <ExtractionAgentSessionList />
        </ExtractionAgentSessionsRoute>
      )
    default:
      return <ErrorRoute error={"Unknown agent type"} />
  }
}
