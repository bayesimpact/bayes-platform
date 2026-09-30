import type { AgentSettingsDto } from "@caseai-connect/api-contracts/src/agents/settings/agent-settings.dto"
import type { Agent } from "../agent.entity"
import type { AgentSettings } from "./agent-settings.entity"

export function toAgentSettingsDto({
  agent,
  agentSettings,
}: {
  agent: Agent
  agentSettings: AgentSettings
}): AgentSettingsDto {
  const documentTagIds = agent.documentTags?.map((tag) => tag.id) || []

  const hasCategories = (agent.sessionCategories?.length ?? 0) > 0

  const mcpServers = (agent.agentMcpServers ?? []).map((agentMcpServer) => ({
    id: agentMcpServer.mcpServer.id,
    name: agentMcpServer.mcpServer.name,
    enabled: agentMcpServer.enabled,
  }))

  const projectAgentSessionCategoryIds = (agent.sessionCategories ?? [])
    .map((category) => category.projectAgentSessionCategoryId)
    .filter(
      (projectAgentSessionCategoryId): projectAgentSessionCategoryId is string =>
        projectAgentSessionCategoryId !== null,
    )

  const resourceLibraryIds = agent.resourceLibraries?.map((library) => library.id) || []

  const usedProjectAgentSessionCategoryIds = (agent.sessionCategories ?? [])
    .filter((category) => (category.conversationSessionCategories?.length ?? 0) > 0)
    .map((category) => category.projectAgentSessionCategoryId)
    .filter(
      (projectAgentSessionCategoryId): projectAgentSessionCategoryId is string =>
        projectAgentSessionCategoryId !== null,
    )

  return {
    agentId: agentSettings.agentId,
    createdAt: agentSettings.createdAt.getTime(),
    description: agentSettings.revisionDesc,
    documentsRagMode: agentSettings.documentsRagMode,
    documentTagIds,
    embeddingModel: agentSettings.embeddingModel ?? undefined,
    fillFormEnabled: agentSettings.fillFormEnabled,
    priorityCallsEnabled: agentSettings.priorityCallsEnabled,
    greetingMessage: agentSettings.greetingMessage ?? undefined,
    hasCategories,
    id: agentSettings.id,
    instructions: agentSettings.instructions,
    isArchived: agentSettings.isArchived,
    isDraft: agentSettings.isDraft,
    locale: agentSettings.locale,
    mcpServers,
    model: agentSettings.model,
    name: agentSettings.revisionName,
    outputJsonSchema: agentSettings.outputJsonSchema ?? undefined,
    projectAgentSessionCategoryIds,
    resourceLibraryIds,
    revision: agentSettings.revision,
    temperature: Number(agentSettings.temperature),
    updatedAt: agentSettings.updatedAt.getTime(),
    usedProjectAgentSessionCategoryIds,
    thinkingLevel: agentSettings.thinkingLevel,
  }
}
