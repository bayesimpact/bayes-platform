import type {
  AgentSettingsCreateFields,
  AgentSettingsUpdateFields,
} from "@/domains/agents/settings/agent.settings.types"

const agentSettingsFieldKeys: (keyof AgentSettingsCreateFields)[] = [
  "instructions",
  "documentsRagMode",
  "model",
  "temperature",
  "locale",
  "outputJsonSchema",
  "greetingMessage",
  "fillFormEnabled",
]

export function extractAgentSettingsCreateFields<T extends object>(
  fields: T,
): Partial<AgentSettingsCreateFields> {
  const result = {} as Partial<AgentSettingsCreateFields>

  for (const key of agentSettingsFieldKeys) {
    if (key in fields) {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic call of property
      result[key] = (fields as any)[key]
    }
  }

  return result
}

export function extractAgentSettingsUpdateFields<T extends object>(
  fields: T,
): Partial<AgentSettingsUpdateFields> {
  const result = {} as Partial<AgentSettingsUpdateFields>

  for (const key of agentSettingsFieldKeys) {
    if (key in fields) {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic call of property
      result[key] = (fields as any)[key]
    }
  }
  return result
}
export function requiresNewAgentSettingsRevision({
  initialAgentSettings,
  modifiedAgentSettings,
}: {
  initialAgentSettings: Partial<AgentSettingsUpdateFields>
  modifiedAgentSettings: Partial<AgentSettingsUpdateFields>
}): boolean {
  for (const key of agentSettingsFieldKeys) {
    const initialValue = initialAgentSettings[key]
    const modifiedValue = modifiedAgentSettings[key]

    if (initialValue === undefined && modifiedValue === undefined) continue
    if (initialValue !== modifiedValue) return true
  }
  return false
}
