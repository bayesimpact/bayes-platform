import type {
  AgentSettingsCreateFields,
  AgentSettingsFields,
  AgentSettingsUpdateFields,
} from "@/domains/agents/settings/agent.settings.types"
import type { AgentSettings } from "./agent-settings.entity"

/**
 * The settings of a revision, as a new revision of the same or another agent takes them over,
 * like updateSettings does when it starts a draft from the last revision.
 */
export function toAgentSettingsFields(agentSettings: AgentSettings): AgentSettingsFields {
  const {
    id,
    createdAt,
    updatedAt,
    deletedAt,
    organizationId,
    projectId,
    agentId,
    agent,
    revision,
    revisionName,
    revisionDesc,
    isDraft,
    isArchived,
    ...fields
  } = agentSettings
  return fields
}

const agentSettingsFieldKeys: (keyof AgentSettingsCreateFields)[] = [
  "instructions",
  "documentsRagMode",
  "model",
  "deletedTemperature",
  "outputJsonSchema",
  "greetingMessage",
  "fillFormEnabled",
  "priorityCallsEnabled",
  "providerOptions",
  "memoryMode",
  "variables",
  "embeddingModel",
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
export function requiresUpdateAgentSettings({
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
    // The object fields (model options, variable defaults) are compared by value, so
    // resending them unchanged does not create a revision.
    if (key === "providerOptions" || key === "variables") {
      if (JSON.stringify(initialValue ?? null) !== JSON.stringify(modifiedValue ?? null))
        return true
      continue
    }
    if (initialValue !== modifiedValue) return true
  }
  return false
}
