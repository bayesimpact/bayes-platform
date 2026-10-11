import type { LLMFeatures } from "@/common/interfaces/llm-provider.interface"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"

type AgentWithSettingsRunJobPayloadBase = Pick<Agent, "id" | "name" | "type"> &
  Pick<
    AgentSettings,
    "revision" | "instructions" | "documentsRagMode" | "model" | "locale" | "priorityCallsEnabled"
  > &
  // thinkingLevel and providerOptions are optional: jobs queued before they
  // existed still run, on Auto and on the model's default options.
  Partial<
    Pick<
      AgentSettings,
      "outputJsonSchema" | "greetingMessage" | "thinkingLevel" | "providerOptions"
    >
  >

export type AgentWithSettingsRunJobPayload = {
  settings: AgentWithSettingsRunJobPayloadBase
  llmFeatures: LLMFeatures
}
