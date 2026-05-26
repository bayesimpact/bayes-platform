import { selectCurrentAgentSessionId } from "../features/agents/agent-sessions/current-agent-session-id/current-agent-session-id.selectors"
import { selectCurrentAgentId } from "../features/agents/agents.selectors"
import { selectCurrentOrganizationId } from "../features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "../features/projects/projects.selectors"
import { useRoutesBuilder } from "../routes/build-routes/context"
import { useCurrentId } from "./use-value"

export function useGetProjectRoute() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

  const { build } = useRoutesBuilder()

  return build.projectRoute({ organizationId, projectId })
}

export function useGetAgentRoute() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const agentId = useCurrentId(selectCurrentAgentId)

  const { build } = useRoutesBuilder()

  return build.agentRoute({ organizationId, projectId, agentId })
}

export function useGetAgentSessionRoute() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const agentId = useCurrentId(selectCurrentAgentId)
  const agentSessionId = useCurrentId(selectCurrentAgentSessionId)

  const { build } = useRoutesBuilder()

  return build.agentSessionRoute({ organizationId, projectId, agentId, agentSessionId })
}
