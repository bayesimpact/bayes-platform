import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import type { Agent } from "@/common/features/agents/agents.models"
import { AgentList } from "@/common/features/agents/components/AgentList"
import { AgentRoute } from "@/common/routes/AgentRoute"
import { AgentSessionRoute } from "@/common/routes/agents/AgentSessionRoute"
import { ConversationAgentRoute } from "@/common/routes/agents/ConversationAgentRoute"
import { ExtractionAgentRoute } from "@/common/routes/agents/ExtractionAgentRoute"
import { FormAgentRoute } from "@/common/routes/agents/FormAgentRoute"
import { RoutesBuilderProvider } from "@/common/routes/build-routes/RoutesBuilderProvider"
import { DashboardRoute } from "@/common/routes/DashboardRoute"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
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
import { StudioRoutes } from "./helpers"
import { ProjectAnalyticsRoute } from "./ProjectAnalyticsRoute"
import { ProjectMembershipRoute } from "./ProjectMembershipRoute"
import { ProjectMembershipsRoute } from "./ProjectMembershipsRoute"
import { RestrictedAccess } from "./RestrictedAccess"
import { ReviewCampaignReportRoute } from "./ReviewCampaignReportRoute"
import { StudioAgentSessionRoute } from "./StudioAgentSessionRoute"
import { StudioDashboardRoute } from "./StudioDashboardRoute"
import { StudioRoute } from "./StudioRoute"
import { WebSourcesRoute } from "./WebSourcesRoute"

const extraItems = [
  AgentCreatorButton,
  DocumentsButton,
  MembersButton,
  ReviewCampaignsButton,
  AnalyticsButton,
  EvaluationButton,
]

export const studioRoutes = {
  path: StudioRoutes.home.path,
  element: (
    <RestrictedAccess ability="canAccessStudio">
      <StudioRoute />
    </RestrictedAccess>
  ),
  children: [
    {
      path: StudioRoutes.organization.path,
      element: (
        <RoutesBuilderProvider
          build={{
            agentRoute: StudioRoutes.agent.build,
            agentSessionRoute: StudioRoutes.agentSession.build,
            projectRoute: StudioRoutes.project.build,
          }}
        >
          <DashboardRoute>
            {(user, _projects, organization) => (
              <StudioDashboardRoute user={user} organization={organization} />
            )}
          </DashboardRoute>
        </RoutesBuilderProvider>
      ),
      children: [
        {
          path: StudioRoutes.project.path,
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
              path: StudioRoutes.evaluation.path,
              element: (
                <RestrictedFeature feature="evaluation">
                  <EvaluationRoute />
                </RestrictedFeature>
              ),
            },
            {
              path: StudioRoutes.documents.path,
              element: <DocumentsRoute />,
            },
            {
              path: StudioRoutes.webSources.path,
              element: (
                <RestrictedFeature feature="web_sources">
                  <WebSourcesRoute />
                </RestrictedFeature>
              ),
            },
            {
              path: StudioRoutes.projectAnalytics.path,
              element: (
                <RestrictedFeature feature="project-analytics">
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
              path: StudioRoutes.reviewCampaigns.path,
              element: <CampaignListPage />,
            },
            {
              path: StudioRoutes.reviewCampaignReport.path,
              element: <ReviewCampaignReportRoute />,
            },
            {
              path: StudioRoutes.agent.path,
              element: <AgentRoute>{(agent) => <AgentHandler agent={agent} />}</AgentRoute>,
              children: [
                {
                  path: StudioRoutes.agentSession.path,
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
