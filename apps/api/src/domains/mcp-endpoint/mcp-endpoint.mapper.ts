import { getStudioAgentUrl } from "@/config/public-urls"
import type {
  AgentRecord,
  AgentWithSettings,
  ProjectWithAccess,
  UpdatedAgentSettings,
} from "./mcp-agent-tools.service"
import type {
  McpAgentDto,
  McpCreatedAgentDto,
  McpProjectDto,
  McpUpdatedAgentDto,
} from "./mcp-endpoint.schemas"

export function toMcpProject({ project, canCreateAgents }: ProjectWithAccess): McpProjectDto {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    organizationName: project.organizationName,
    canCreateAgents,
  }
}

export function toMcpCreatedAgent(agent: AgentRecord): McpCreatedAgentDto {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    projectId: agent.projectId,
    organizationId: agent.organizationId,
    studioUrl: toStudioUrl(agent),
  }
}

export function toMcpAgent({ agent, agentSettings, canUpdate }: AgentWithSettings): McpAgentDto {
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
}: UpdatedAgentSettings): McpUpdatedAgentDto {
  return {
    ...toMcpAgent({ agent, agentSettings, canUpdate: true }),
    draftRevision: agentSettings.revision,
  }
}

function toStudioUrl(agent: AgentRecord): string | null {
  return getStudioAgentUrl({
    organizationId: agent.organizationId,
    projectId: agent.projectId,
    agentId: agent.id,
  })
}
