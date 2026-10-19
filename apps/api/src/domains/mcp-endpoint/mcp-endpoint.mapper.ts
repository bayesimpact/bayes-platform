import { getStudioAgentUrl } from "@/config/public-urls"
import type {
  McpAgentRecord,
  McpAgentWithSettings,
  McpProjectWithAccess,
  McpUpdatedAgentSettings,
} from "./mcp-agent-tools.service"
import type { McpAgent, McpCreatedAgent, McpProject, McpUpdatedAgent } from "./mcp-endpoint.schemas"

export function toMcpProject({ project, canCreateAgents }: McpProjectWithAccess): McpProject {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    organizationName: project.organizationName,
    canCreateAgents,
  }
}

export function toMcpCreatedAgent(agent: McpAgentRecord): McpCreatedAgent {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    projectId: agent.projectId,
    organizationId: agent.organizationId,
    studioUrl: toStudioUrl(agent),
  }
}

export function toMcpAgent({ agent, agentSettings, canUpdate }: McpAgentWithSettings): McpAgent {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    model: agentSettings.model,
    canUpdate,
    studioUrl: toStudioUrl(agent),
  }
}

export function toMcpUpdatedAgent({
  agent,
  agentSettings,
}: McpUpdatedAgentSettings): McpUpdatedAgent {
  return {
    ...toMcpAgent({ agent, agentSettings, canUpdate: true }),
    draftRevision: agentSettings.revision,
  }
}

function toStudioUrl(agent: McpAgentRecord): string | null {
  return getStudioAgentUrl({
    organizationId: agent.organizationId,
    projectId: agent.projectId,
    agentId: agent.id,
  })
}
