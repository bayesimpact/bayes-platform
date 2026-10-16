import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"

export type AgentSettingsCreateFields = Pick<
  AgentSettings,
  "instructions" | "documentsRagMode" | "model" | "locale" | "providerOptions"
> &
  Partial<
    Pick<
      AgentSettings,
      | "outputJsonSchema"
      | "greetingMessage"
      | "fillFormEnabled"
      | "priorityCallsEnabled"
      | "deletedTemperature"
      | "memoryMode"
    >
  >

export type AgentSettingsUpdateFields = Partial<
  Pick<
    AgentSettings,
    | "instructions"
    | "greetingMessage"
    | "documentsRagMode"
    | "model"
    | "deletedTemperature"
    | "locale"
    | "outputJsonSchema"
    | "fillFormEnabled"
    | "priorityCallsEnabled"
    | "providerOptions"
    | "memoryMode"
  >
>
