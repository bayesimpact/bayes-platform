import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { AgentRoute } from "@/common/routes/AgentRoute"
import { AgentSessionRoute } from "@/common/routes/agents/AgentSessionRoute"
import { ConversationAgentSessionsRoute } from "@/common/routes/agents/ConversationAgentSessionsRoute"
import { ExtractionAgentSessionsRoute } from "@/common/routes/agents/ExtractionAgentSessionsRoute"
import { AgentCsvExtractionRunRoute } from "@/common/routes/agents/extraction/AgentCsvExtractionRunRoute"
import { AgentExtractionRoute } from "@/common/routes/agents/extraction/AgentExtractionRoute"
import { AgentExtractionRunRoute } from "@/common/routes/agents/extraction/AgentExtractionRunRoute"
import { FormAgentSessionsRoute } from "@/common/routes/agents/FormAgentSessionsRoute"
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
                agentExtractionCsvRunRoute: DeskRoutes.agentExtractionCsvRun.build,
                agentExtractionRunRoute: DeskRoutes.agentExtractionRun.build,
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
              <AgentSessionsHandler />
            </AgentRoute>
          ),
          children: [
            {
              path: DeskRoutes.agentSession.path,
              element: <AgentSessionRoute Component={DeskAgentSessionRoute} />,
            },

            {
              path: DeskRoutes.agentExtraction.path,
              element: (
                <AgentExtractionRoute buildCsvRunPath={DeskRoutes.agentExtractionCsvRun.build} />
              ),
              children: [
                {
                  path: DeskRoutes.agentExtractionCsvRun.path,
                  element: <AgentCsvExtractionRunRoute />,
                },
                {
                  path: DeskRoutes.agentExtractionRun.path,
                  element: <AgentExtractionRunRoute />,
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
