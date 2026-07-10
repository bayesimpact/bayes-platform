import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"

export type AgentSettingsCreateFields = Pick<
  AgentSettings,
  "instructions" | "documentsRagMode" | "model" | "temperature" | "locale"
> &
  Partial<Pick<AgentSettings, "outputJsonSchema" | "greetingMessage">>

export type AgentSettingsUpdateFields = Partial<
  Pick<
    AgentSettings,
    | "instructions"
    | "greetingMessage"
    | "documentsRagMode"
    | "model"
    | "temperature"
    | "locale"
    | "outputJsonSchema"
  >
>
