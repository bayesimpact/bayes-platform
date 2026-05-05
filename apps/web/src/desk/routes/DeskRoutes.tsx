import { Outlet } from "react-router-dom"
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
import {
  ConversationAgentSessionList,
  ExtractionAgentSessionList,
  FormAgentSessionList,
} from "../features/agents/components/AgentSessionList"
import { DeskAgentSessionRoute } from "./DeskAgentSessionRoute"
import { DeskDashboardRoute } from "./DeskDashboardRoute"
import { buildDeskPath, DeskRouteNames } from "./helpers"

export const deskRoutes = {
  path: DeskRouteNames.HOME,
  element: <Outlet />,
  children: [
    {
      path: buildDeskPath(RouteNames.ORGANIZATION_DASHBOARD),
      element: (
        <DashboardRoute>
          {(user, _projects, organization) => (
            <DeskDashboardRoute user={user} organization={organization} />
          )}
        </DashboardRoute>
      ),
      children: [
        {
          path: buildDeskPath(RouteNames.PROJECT),
          element: (
            <ProjectRoute>
              {(agents, project) => <AgentList project={project} agents={agents} />}
            </ProjectRoute>
          ),
          children: [
            {
              path: buildDeskPath(RouteNames.AGENT),
              element: <AgentRoute>{(agent) => <AgentHandler agent={agent} />}</AgentRoute>,
              children: [
                {
                  path: buildDeskPath(RouteNames.AGENT_SESSION),
                  element: (
                    <AgentSessionRoute>
                      {(agent, agentSession, messages) => (
                        <DeskAgentSessionRoute
                          agent={agent}
                          agentSession={agentSession}
                          messages={messages}
                        />
                      )}
                    </AgentSessionRoute>
                  ),
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
