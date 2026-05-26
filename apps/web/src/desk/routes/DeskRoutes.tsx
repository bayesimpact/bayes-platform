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
import { AgentList } from "../features/agents/components/AgentList"
import {
  ConversationAgentSessionList,
  ExtractionAgentSessionList,
  FormAgentSessionList,
} from "../features/agents/components/AgentSessionList"
import { DeskAgentSessionRoute } from "./DeskAgentSessionRoute"
import { DeskLayout } from "./DeskLayout"
import { DeskRoute } from "./DeskRoute"
import { DeskRoutes } from "./helpers"

export const deskRoutes = {
  path: DeskRoutes.home.path,
  element: <DeskRoute />,
  children: [
    {
      path: DeskRoutes.project.path,
      element: (
        <OrganizationRoute>
          <ProjectRoute>
            <RoutesBuilderProvider
              build={{
                agentRoute: DeskRoutes.agent.build,
                agentSessionRoute: DeskRoutes.agentSession.build,
                projectRoute: DeskRoutes.project.build,
              }}
            >
              <DeskLayout>
                <AgentList />
              </DeskLayout>
            </RoutesBuilderProvider>
          </ProjectRoute>
        </OrganizationRoute>
      ),
      children: [
        {
          path: DeskRoutes.agent.path,
          element: (
            <AgentRoute>
              <AgentHandler />
            </AgentRoute>
          ),
          children: [
            {
              path: DeskRoutes.agentSession.path,
              element: <AgentSessionRoute Component={DeskAgentSessionRoute} />,
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
