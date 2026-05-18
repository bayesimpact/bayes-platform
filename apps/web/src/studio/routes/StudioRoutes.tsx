import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import type { Agent } from "@/common/features/agents/agents.models"
import { AgentList } from "@/common/features/agents/components/AgentList"
import { AgentRoute } from "@/common/routes/AgentRoute"
import { AgentSessionRoute } from "@/common/routes/agents/AgentSessionRoute"
import { ConversationAgentRoute } from "@/common/routes/agents/ConversationAgentRoute"
import { ExtractionAgentRoute } from "@/common/routes/agents/ExtractionAgentRoute"
import { FormAgentRoute } from "@/common/routes/agents/FormAgentRoute"
import { DashboardRoute } from "@/common/routes/DashboardRoute"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { RouteNames } from "@/common/routes/helpers"
import { ProjectRoute } from "@/common/routes/ProjectRoute"
import { AgentCreatorButton } from "@/studio/features/agents/components/AgentCreator"
import {
  ConversationAgentSessionList,
  ExtractionAgentSessionList,
  FormAgentSessionList,
} from "@/studio/features/agents/components/AgentSessionList"
import { AnalyticsButton } from "@/studio/features/agents/components/AnalyticsButton"
import { DocumentsButton } from "@/studio/features/agents/components/DocumentsButton"
import { EvaluationButton } from "@/studio/features/agents/components/EvaluationButton"
import { MembersButton } from "@/studio/features/agents/components/MembersButton"
import { ProjectDeletor } from "@/studio/features/projects/components/ProjectDeletor"
import { ProjectEditor } from "@/studio/features/projects/components/ProjectEditor"
import { CampaignListPage } from "@/studio/features/review-campaigns/components/CampaignListPage"
import { ReviewCampaignsButton } from "@/studio/features/review-campaigns/components/ReviewCampaignsButton"
import { AgentAnalyticsRoute } from "./AgentAnalyticsRoute"
import { AgentMembershipsRoute } from "./AgentMembershipsRoute"
import { DocumentsRoute } from "./DocumentsRoute"
import { EvaluationRoute } from "./EvaluationRoute"
import { FeedbackRoute } from "./FeedbackRoute"
import { buildStudioPath, StudioRouteNames } from "./helpers"
import { ProjectAnalyticsRoute } from "./ProjectAnalyticsRoute"
import { ProjectMembershipRoute } from "./ProjectMembershipRoute"
import { ProjectMembershipsRoute } from "./ProjectMembershipsRoute"
import { RestrictedAccess } from "./RestrictedAccess"
import { ReviewCampaignReportRoute } from "./ReviewCampaignReportRoute"
import { StudioAgentSessionRoute } from "./StudioAgentSessionRoute"
import { StudioDashboardRoute } from "./StudioDashboardRoute"
import { StudioRoute } from "./StudioRoute"

const extraItems = [
  AgentCreatorButton,
  DocumentsButton,
  MembersButton,
  ReviewCampaignsButton,
  AnalyticsButton,
  EvaluationButton,
]

export const studioRoutes = {
  path: StudioRouteNames.HOME,
  element: (
    <RestrictedAccess ability="canAccessStudio">
      <StudioRoute />
    </RestrictedAccess>
  ),
  children: [
    {
      path: buildStudioPath(RouteNames.ORGANIZATION_DASHBOARD),
      element: (
        <DashboardRoute>
          {(user, _projects, organization) => (
            <StudioDashboardRoute user={user} organization={organization} />
          )}
        </DashboardRoute>
      ),
      children: [
        {
          path: buildStudioPath(RouteNames.PROJECT),
          element: (
            <ProjectRoute>
              {(agents, project) => (
                <AgentList
                  extraItems={extraItems.length}
                  action={
                    <>
                      <ProjectEditor project={project} />
                      <ProjectDeletor project={project} />
                    </>
                  }
                  project={project}
                  agents={agents}
                >
                  {extraItems.map((Component, index) => (
                    <Component
                      key={`${Component.name}-${index}`}
                      project={project}
                      index={agents.length + index}
                    />
                  ))}
                </AgentList>
              )}
            </ProjectRoute>
          ),
          children: [
            {
              path: buildStudioPath(StudioRouteNames.EVALUATION),
              element: (
                <RestrictedFeature feature="evaluation">
                  <EvaluationRoute />
                </RestrictedFeature>
              ),
            },
            {
              path: buildStudioPath(StudioRouteNames.DOCUMENTS),
              element: <DocumentsRoute />,
            },
            {
              path: buildStudioPath(StudioRouteNames.PROJECT_ANALYTICS),
              element: (
                <RestrictedFeature feature="project-analytics">
                  <ProjectAnalyticsRoute />
                </RestrictedFeature>
              ),
            },
            {
              path: buildStudioPath(StudioRouteNames.PROJECT_MEMBERSHIPS),
              element: <ProjectMembershipsRoute />,
              children: [
                {
                  path: buildStudioPath(StudioRouteNames.PROJECT_MEMBERSHIP),
                  element: <ProjectMembershipRoute />,
                },
              ],
            },
            {
              path: buildStudioPath(StudioRouteNames.REVIEW_CAMPAIGNS),
              element: <CampaignListPage />,
            },
            {
              path: buildStudioPath(StudioRouteNames.REVIEW_CAMPAIGN_REPORT),
              element: <ReviewCampaignReportRoute />,
            },
            {
              path: buildStudioPath(RouteNames.AGENT),
              element: <AgentRoute>{(agent) => <AgentHandler agent={agent} />}</AgentRoute>,
              children: [
                {
                  path: buildStudioPath(RouteNames.AGENT_SESSION),
                  element: (
                    <AgentSessionRoute>
                      {(agent, agentSession, messages) => (
                        <StudioAgentSessionRoute
                          agent={agent}
                          agentSession={agentSession}
                          messages={messages}
                        />
                      )}
                    </AgentSessionRoute>
                  ),
                },
                {
                  element: <RestrictedAccess ability="canManageAgent" />,
                  children: [
                    {
                      path: buildStudioPath(StudioRouteNames.AGENT_ANALYTICS),
                      element: (
                        <RestrictedFeature feature="project-analytics">
                          <AgentAnalyticsRoute />
                        </RestrictedFeature>
                      ),
                    },
                    {
                      path: buildStudioPath(StudioRouteNames.FEEDBACK),
                      element: <FeedbackRoute />,
                    },
                    {
                      path: buildStudioPath(StudioRouteNames.AGENT_MEMBERSHIPS),
                      element: <AgentMembershipsRoute />,
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

function AgentHandler({ agent }: { agent: Agent }) {
  switch (agent.type) {
    case "conversation":
      return (
        <ConversationAgentRoute>
          {(agentSessions) => (
            <ConversationAgentSessionList agentSessions={agentSessions} agent={agent} />
          )}
        </ConversationAgentRoute>
      )
    case "form":
      return (
        <FormAgentRoute>
          {(agentSessions) => <FormAgentSessionList agentSessions={agentSessions} agent={agent} />}
        </FormAgentRoute>
      )
    case "extraction":
      return (
        <ExtractionAgentRoute>
          {(agentSessions) => (
            <ExtractionAgentSessionList agentSessions={agentSessions} agent={agent} />
          )}
        </ExtractionAgentRoute>
      )
    default:
      return <ErrorRoute error={"Unknown agent type"} />
  }
}
