import type { Agent } from "@/common/features/agents/agents.models"

/** Settings fields that are versioned by the backend (one revision per change). */
export const agentSettingsDiffKeys = [
  "instructions",
  "greetingMessage",
  "model",
  "temperature",
  "locale",
  "documentsRagMode",
  "outputJsonSchema",
] as const

export type AgentSettingsDiffKey = (typeof agentSettingsDiffKeys)[number]

/** The file name drives @pierre/diffs syntax highlighting (md for prose, json for the schema). */
export const agentSettingsDiffFileNames: Record<AgentSettingsDiffKey, string> = {
  instructions: "instructions.md",
  greetingMessage: "greeting-message.md",
  model: "model.txt",
  temperature: "temperature.txt",
  locale: "language.txt",
  documentsRagMode: "documents-rag-mode.txt",
  outputJsonSchema: "output-json-schema.json",
}

export const agentSettingsDiffLabelKeys: Record<AgentSettingsDiffKey, string> = {
  instructions: "agent:props.instructions",
  greetingMessage: "agent:props.greeting",
  model: "agent:props.model",
  temperature: "agent:props.temperature",
  locale: "agent:props.locale",
  documentsRagMode: "agent:props.documentsRagMode",
  outputJsonSchema: "agent:props.outputJsonSchema",
}

export function serializeAgentSettingsField(agent: Agent, key: AgentSettingsDiffKey): string {
  const value = agent[key]
  if (value === undefined || value === null) return ""
  if (key === "outputJsonSchema") return JSON.stringify(value, null, 2)
  return String(value)
}

export function listChangedAgentSettingsFields(
  before: Agent,
  after: Agent,
): AgentSettingsDiffKey[] {
  return agentSettingsDiffKeys.filter(
    (key) => serializeAgentSettingsField(before, key) !== serializeAgentSettingsField(after, key),
  )
}
