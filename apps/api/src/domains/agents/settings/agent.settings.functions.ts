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
    isProduction,
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
  "followUpSuggestionsEnabled",
  "followUpSuggestionsInstructions",
  "followUpSuggestionsMax",
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

/**
 * Whether two revisions hold the same settings. Every field is compared by value: two revisions
 * read from the database never share their objects (form schema, model options, variables).
 */
export function hasSameAgentSettings(
  first: Partial<AgentSettingsUpdateFields>,
  second: Partial<AgentSettingsUpdateFields>,
): boolean {
  return agentSettingsFieldKeys.every((key) =>
    isSameJsonValue(first[key] ?? null, second[key] ?? null),
  )
}

/** Deep equality of two JSON values. The order of an object's keys does not count. */
function isSameJsonValue(first: unknown, second: unknown): boolean {
  if (first === second) return true
  if (typeof first !== "object" || typeof second !== "object" || !first || !second) return false
  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((item, index) => isSameJsonValue(item, second[index]))
    )
  }
  const firstEntries = Object.entries(first)
  const secondRecord = second as Record<string, unknown>
  return (
    firstEntries.length === Object.keys(second).length &&
    firstEntries.every(
      ([key, value]) => key in secondRecord && isSameJsonValue(value, secondRecord[key]),
    )
  )
}
