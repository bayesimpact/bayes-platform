import { createFileRoute, redirect } from "@tanstack/react-router"
import { AgentHubPage } from "@/routes/-components/AgentHubPage"
import { AGENT_SECTION_ROUTES, agentSectionsOf } from "@/routes/-components/agent-sections"

/**
 * The first page of an agent. An agent that opens one section for the person opens on it; with
 * several, this page is the hub that lists them.
 */
export const Route = createFileRoute("/_authenticated/o/$organizationId/p/$projectId/a/$agentId/")({
  beforeLoad: ({ context, params }) => {
    const sections = agentSectionsOf(context.agent)
    const [onlySection] = sections
    if (onlySection && sections.length === 1) {
      // The search goes along: the command center the home asked for opens on the section.
      throw redirect({ to: AGENT_SECTION_ROUTES[onlySection], params, search: true, replace: true })
    }
  },
  component: AgentRoute,
})

function AgentRoute() {
  const { agent } = Route.useRouteContext()
  return (
    <AgentHubPage agent={agent} agentParams={Route.useParams()} sections={agentSectionsOf(agent)} />
  )
}
