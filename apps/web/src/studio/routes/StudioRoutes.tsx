import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { AgentRoute } from "@/common/routes/AgentRoute"
import { AgentSessionRoute } from "@/common/routes/agents/AgentSessionRoute"
import { ConversationAgentRoute } from "@/common/routes/agents/ConversationAgentRoute"
import { ExtractionAgentRoute } from "@/common/routes/agents/ExtractionAgentRoute"
import { FormAgentRoute } from "@/common/routes/agents/FormAgentRoute"
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
import { ProjectDocumentsRoute, WebSourcesDocumentsRoute } from "./DocumentsRoute"
import { EvaluationRoute } from "./EvaluationRoute"
import { FeedbackRoute } from "./FeedbackRoute"
import { StudioRoutes } from "./helpers"
import { ProjectAnalyticsRoute } from "./ProjectAnalyticsRoute"
import { ProjectMembershipRoute } from "./ProjectMembershipRoute"
import { ProjectMembershipsRoute } from "./ProjectMembershipsRoute"
import { RestrictedAccess } from "./RestrictedAccess"
import { ReviewCampaignReportRoute } from "./ReviewCampaignReportRoute"
import { StudioAgentSessionRoute } from "./StudioAgentSessionRoute"
import { StudioRoute } from "./StudioRoute"

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
              <WebSourcesDocumentsRoute />
            </RestrictedFeature>
          ),
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
              <AgentHandler />
            </AgentRoute>
          ),
          children: [
            {
              path: StudioRoutes.agentSession.path,
              element: <AgentSessionRoute Component={StudioAgentSessionRoute} />,
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

function AgentHandler() {
  const agent = useValue(selectCurrentAgentData)
  switch (agent.type) {
    case "conversation":
      return (
        <ConversationAgentRoute>
          <ConversationAgentSessionList />
        </ConversationAgentRoute>
      )
    case "form":
      return (
        <FormAgentRoute>
          <FormAgentSessionList />
        </FormAgentRoute>
      )
    case "extraction":
      return (
        <ExtractionAgentRoute>
          <ExtractionAgentSessionList />
        </ExtractionAgentRoute>
      )
    default:
      return <ErrorRoute error={"Unknown agent type"} />
  }
}
