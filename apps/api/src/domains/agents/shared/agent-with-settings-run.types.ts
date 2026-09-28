import type { LLMFeatures } from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"

type AgentWithSettingsRunJobPayloadBase = Pick<Agent, "id" | "name" | "type"> &
  Pick<
    AgentSettings,
    | "revision"
    | "instructions"
    | "documentsRagMode"
    | "model"
    | "temperature"
    | "locale"
    | "priorityCallsEnabled"
    | "embeddingModel"
  > &
  Partial<Pick<AgentSettings, "outputJsonSchema" | "greetingMessage">>

export type AgentWithSettingsRunJobPayload = {
  settings: AgentWithSettingsRunJobPayloadBase
  llmFeatures: LLMFeatures
}
