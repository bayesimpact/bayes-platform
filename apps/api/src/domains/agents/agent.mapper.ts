import {
  type AgentDto,
  type AgentRevisionDto,
  type AgentSubAgentDto,
  type AgentWithDraftDto,
  isAgentPermission,
} from "@caseai-connect/api-contracts"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Agent } from "./agent.entity"
import type { AgentSubAgent } from "./sub-agents/agent-sub-agent.entity"

/** `permissions` are the caller's on the agent; the DTO keeps the ones the studio reads. */
export function toAgentDto({
  agent,
  agentSettings,
  permissions,
}: {
  agent: Agent
  agentSettings: AgentSettings
  permissions: string[]
}): AgentDto {
  return {
    createdAt: agent.createdAt.getTime(),
    id: agent.id,
    currentRevision: toAgentRevisionDto(agentSettings),
    name: agent.name,
    projectId: agent.projectId,
    type: agent.type,
    permissions: permissions.filter(isAgentPermission),
  }
}

/** `currentAgentSettings` is the published revision, missing while the agent was never published. */
export function toAgentWithDraftDto({
  agent,
  currentAgentSettings,
  draftAgentSettings,
  permissions,
}: {
  agent: Agent
  currentAgentSettings?: AgentSettings
  draftAgentSettings?: AgentSettings
  permissions: string[]
}): AgentWithDraftDto {
  return {
    createdAt: agent.createdAt.getTime(),
    id: agent.id,
    currentRevision: currentAgentSettings ? toAgentRevisionDto(currentAgentSettings) : undefined,
    draftRevision: draftAgentSettings ? toAgentRevisionDto(draftAgentSettings) : undefined,
    name: agent.name,
    projectId: agent.projectId,
    type: agent.type,
    permissions: permissions.filter(isAgentPermission),
  }
}

function toAgentRevisionDto(agentSettings: AgentSettings): AgentRevisionDto {
  return {
    updatedAt: agentSettings.updatedAt.getTime(),
    name: agentSettings.revisionName,
    description: agentSettings.revisionDesc,
    number: agentSettings.revision,
  }
}

export function toAgentSubAgentDto(entity: AgentSubAgent): AgentSubAgentDto {
  return {
    id: entity.id,
    parentAgentId: entity.parentAgentId,
    childAgentId: entity.childAgentId,
    toolName: entity.toolName,
    description: entity.description,
    enabled: entity.enabled,
    mode: entity.mode,
    childAgent: entity.childAgent
      ? {
          id: entity.childAgent.id,
          name: entity.childAgent.name,
          type: entity.childAgent.type,
        }
      : undefined,
    createdAt: entity.createdAt.getTime(),
    updatedAt: entity.updatedAt.getTime(),
  }
}
