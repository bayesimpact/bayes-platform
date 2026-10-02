import type { LLMFeatures } from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { AgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.types"

export function toAgentWithSettingsRunJobPayload({
  agent,
  agentSettings,
  llmFeatures,
}: {
  agent: Agent
  agentSettings: AgentSettings
  llmFeatures: LLMFeatures
}): AgentWithSettingsRunJobPayload {
  return {
    settings: {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      revision: agentSettings.revision,
      instructions: agentSettings.instructions,
      model: agentSettings.model,
      temperature: agentSettings.temperature,
      locale: agentSettings.locale,
      documentsRagMode: agentSettings.documentsRagMode,
      outputJsonSchema: agentSettings.outputJsonSchema,
      greetingMessage: agentSettings.greetingMessage,
      priorityCallsEnabled: agentSettings.priorityCallsEnabled,
      thinkingLevel: agentSettings.thinkingLevel,
    },
    llmFeatures,
  } satisfies AgentWithSettingsRunJobPayload
}
