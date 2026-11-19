import type { AgentVersionOutputDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** The fields of a version that change from one version to another, in the order they show. */
const AGENT_VERSION_DIFF_KEYS = [
  "instructions",
  "greetingMessage",
  "model",
  "providerOptions",
  "documentsRagMode",
  "outputJsonSchema",
  "fillFormEnabled",
  "priorityCallsEnabled",
  "variables",
  "embeddingModel",
  "followUpSuggestionsEnabled",
  "followUpSuggestionsInstructions",
  "followUpSuggestionsMax",
] as const satisfies readonly (keyof AgentVersionOutputDto)[]

export type AgentVersionDiffKey = (typeof AGENT_VERSION_DIFF_KEYS)[number]

/** The name of each field, as the diff titles it. */
export const AGENT_VERSION_DIFF_LABELS = {
  instructions: msg({ message: "Instructions", comment: "The instructions of an agent" }),
  greetingMessage: msg({
    message: "Greeting",
    comment: "The first message of an agent in a conversation",
  }),
  model: msg({ message: "Model", comment: "The language model of an agent" }),
  providerOptions: msg({ message: "Model options", comment: "The options of an agent's model" }),
  documentsRagMode: msg({
    message: "Documents used",
    comment: "Which documents of its project an agent searches",
  }),
  outputJsonSchema: msg({
    message: "Form",
    comment: "The form an agent fills during a conversation",
  }),
  fillFormEnabled: msg({
    message: "Form filling",
    comment: "Whether an agent fills a form during a conversation",
  }),
  priorityCallsEnabled: msg({
    message: "Priority calls",
    comment: "Whether an agent's calls to its model go first",
  }),
  variables: msg({
    message: "Prompt variables",
    comment: "The default values of the variables of an agent's instructions",
  }),
  embeddingModel: msg({
    message: "Embedding model",
    comment: "The model an agent searches its documents with",
  }),
  followUpSuggestionsEnabled: msg({
    message: "Follow-up suggestions",
    comment: "Whether an agent suggests follow-up questions",
  }),
  followUpSuggestionsInstructions: msg({
    message: "Follow-up suggestions instructions",
    comment: "How an agent writes its follow-up questions",
  }),
  followUpSuggestionsMax: msg({
    message: "Follow-up suggestions at most",
    comment: "How many follow-up questions an agent suggests at most",
  }),
} as const satisfies Record<AgentVersionDiffKey, MessageDescriptor>

/** The file name of each field: its extension picks the diff's highlighting. */
export const AGENT_VERSION_DIFF_FILE_NAMES = {
  instructions: "instructions.md",
  greetingMessage: "greeting.md",
  model: "model.txt",
  providerOptions: "model-options.json",
  documentsRagMode: "documents.txt",
  outputJsonSchema: "form.json",
  fillFormEnabled: "form-filling.txt",
  priorityCallsEnabled: "priority-calls.txt",
  variables: "prompt-variables.json",
  embeddingModel: "embedding-model.txt",
  followUpSuggestionsEnabled: "follow-up-suggestions.txt",
  followUpSuggestionsInstructions: "follow-up-suggestions.md",
  followUpSuggestionsMax: "follow-up-suggestions-max.txt",
} as const satisfies Record<AgentVersionDiffKey, string>

/** A field of a version as text: an object as indented JSON, nothing as an empty text. */
export function agentVersionFieldText(
  version: AgentVersionOutputDto,
  key: AgentVersionDiffKey,
): string {
  const value = version[key]
  if (value === undefined || value === null) return ""
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

/** The fields that differ from one version to the other. */
export function changedAgentVersionFields(
  before: AgentVersionOutputDto,
  after: AgentVersionOutputDto,
): AgentVersionDiffKey[] {
  return AGENT_VERSION_DIFF_KEYS.filter(
    (key) => agentVersionFieldText(before, key) !== agentVersionFieldText(after, key),
  )
}
