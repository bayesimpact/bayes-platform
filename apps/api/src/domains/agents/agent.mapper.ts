import type { AgentDto, AgentWithDraftDto } from "@caseai-connect/api-contracts"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Agent } from "./agent.entity"

export function toAgentDto({
  agent,
  agentSettings,
}: {
  agent: Agent
  agentSettings: AgentSettings
}): AgentDto {
  return {
    createdAt: agent.createdAt.getTime(),
    id: agent.id,
    currentRevision: {
      updatedAt: agentSettings.updatedAt.getTime(),
      name: agentSettings.revisionName,
      description: agentSettings.revisionDesc,
      number: agentSettings.revision,
    },
    name: agent.name,
    projectId: agent.projectId,
    type: agent.type,
  }
}

export function toAgentWithDraftDto({
  agent,
  currentAgentSettings,
  draftAgentSettings,
}: {
  agent: Agent
  currentAgentSettings: AgentSettings
  draftAgentSettings?: AgentSettings
}): AgentWithDraftDto {
  return {
    createdAt: agent.createdAt.getTime(),
    id: agent.id,
    currentRevision: {
      updatedAt: currentAgentSettings.updatedAt.getTime(),
      name: currentAgentSettings.revisionName,
      description: currentAgentSettings.revisionDesc,
      number: currentAgentSettings.revision,
    },
    draftRevision: draftAgentSettings
      ? {
          updatedAt: draftAgentSettings.updatedAt.getTime(),
          name: draftAgentSettings.revisionName,
          description: draftAgentSettings.revisionDesc,
          number: draftAgentSettings.revision,
        }
      : undefined,
    name: agent.name,
    projectId: agent.projectId,
    type: agent.type,
  }
}
