import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"

export type AgentWithSettingsRunJobPayload = Pick<Agent, "id" | "name" | "type"> &
  Pick<
    AgentSettings,
    "revision" | "instructions" | "documentsRagMode" | "model" | "temperature" | "locale"
  > &
  Partial<Pick<AgentSettings, "outputJsonSchema" | "greetingMessage">>
