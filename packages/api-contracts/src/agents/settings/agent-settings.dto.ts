import { z } from "zod"
import {
  type DocumentTagDto,
  documentTagSchema,
  updateDocumentTagsSchema,
} from "../../document-tags/document-tag.dto"
import type { TimeType } from "../../generic"
import { EmbeddingModel } from "../../project-embedding-models/project-embedding-models.dto"

export enum AgentModel {
  Gemini25Flash = "gemini-2.5-flash",
  Gemini25Pro = "gemini-2.5-pro",
  Gemini31FlashLite = "gemini-3.1-flash-lite",
  Gemini35FlashLite = "gemini-3.5-flash-lite",
  Gemini35Flash = "gemini-3.5-flash",
  Gemini36Flash = "gemini-3.6-flash",
  Gemini37Flash = "gemini-3.7-flash",
  Gemini38Flash = "gemini-3.8-flash",
  Gemini4Argon = "gemini-4-argon",
  Gemini4Carbon = "gemini-4-carbon",
  Gemini4Hydrogen = "gemini-4-hydrogen",
  MedGemma10_27B = "google/medgemma-27b-it",
  Gemma4_26B = "google/gemma-4-26b-A4B-it",
  Gemma4_31B = "google/gemma-4-31B-it",
  MistralSmall31_24B = "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
  MistralSmall32_24B = "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
  Qwen38_27B = "Qwen/Qwen3.8-27B",
  ClaudeSonnet55 = "claude-sonnet-5-5",
  ClaudeHaiku55 = "claude-haiku-5-5",
  ClaudeOpus5 = "claude-opus-5",
  ClaudeOpus55 = "claude-opus-5-5",
  Gpt54 = "gpt-5.4",
  Gpt54Mini = "gpt-5.4-mini",
  _Mock = "mock-language-model-v3",
}

export enum AgentProvider {
  MedGemma = "MED-GEMMA",
  Gemma = "GEMMA",
  Vertex = "VERTEX",
  Mistral = "MISTRAL",
  Vertex3 = "VERTEX-3",
  Vertex4 = "VERTEX-4",
  Qwen = "QWEN",
  Anthropic = "ANTHROPIC",
  OpenAI = "OPENAI",
  _Mock = "MOCK",
}
export const AgentModelToAgentProvider = {
  [AgentModel.Gemini25Flash]: AgentProvider.Vertex,
  [AgentModel.Gemini25Pro]: AgentProvider.Vertex,
  [AgentModel.Gemini31FlashLite]: AgentProvider.Vertex3,
  [AgentModel.Gemini35FlashLite]: AgentProvider.Vertex3,
  [AgentModel.Gemini35Flash]: AgentProvider.Vertex3,
  [AgentModel.Gemini36Flash]: AgentProvider.Vertex3,
  [AgentModel.Gemini37Flash]: AgentProvider.Vertex3,
  [AgentModel.Gemini38Flash]: AgentProvider.Vertex3,
  [AgentModel.Gemini4Argon]: AgentProvider.Vertex4,
  [AgentModel.Gemini4Carbon]: AgentProvider.Vertex4,
  [AgentModel.Gemini4Hydrogen]: AgentProvider.Vertex4,
  [AgentModel.MedGemma10_27B]: AgentProvider.MedGemma,
  [AgentModel.Gemma4_26B]: AgentProvider.Gemma,
  [AgentModel.Gemma4_31B]: AgentProvider.Gemma,
  [AgentModel.MistralSmall31_24B]: AgentProvider.Mistral,
  [AgentModel.MistralSmall32_24B]: AgentProvider.Mistral,
  [AgentModel.Qwen38_27B]: AgentProvider.Qwen,
  [AgentModel.ClaudeSonnet55]: AgentProvider.Anthropic,
  [AgentModel.ClaudeHaiku55]: AgentProvider.Anthropic,
  [AgentModel.ClaudeOpus5]: AgentProvider.Anthropic,
  [AgentModel.ClaudeOpus55]: AgentProvider.Anthropic,
  [AgentModel.Gpt54]: AgentProvider.OpenAI,
  [AgentModel.Gpt54Mini]: AgentProvider.OpenAI,
  [AgentModel._Mock]: AgentProvider._Mock,
} as const satisfies Record<AgentModel, AgentProvider>

/** The vendor the apps group each provider's models under. */
export const AgentProviderVendors = {
  [AgentProvider.Vertex]: "Google",
  [AgentProvider.Vertex3]: "Google",
  [AgentProvider.Vertex4]: "Google",
  [AgentProvider.Gemma]: "Google",
  [AgentProvider.MedGemma]: "Google",
  [AgentProvider.Mistral]: "Mistral",
  [AgentProvider.Qwen]: "Qwen",
  [AgentProvider.Anthropic]: "Anthropic",
  [AgentProvider.OpenAI]: "OpenAI",
  [AgentProvider._Mock]: "Test",
} as const satisfies Record<AgentProvider, string>

/** The name the apps show for each model; the id stays visible beside it. */
export const AgentModelDisplayNames = {
  [AgentModel.Gemini25Flash]: "Gemini 2.5 Flash",
  [AgentModel.Gemini25Pro]: "Gemini 2.5 Pro",
  [AgentModel.Gemini31FlashLite]: "Gemini 3.1 Flash Lite",
  [AgentModel.Gemini35FlashLite]: "Gemini 3.5 Flash Lite",
  [AgentModel.Gemini35Flash]: "Gemini 3.5 Flash",
  [AgentModel.Gemini36Flash]: "Gemini 3.6 Flash",
  [AgentModel.Gemini37Flash]: "Gemini 3.7 Flash",
  [AgentModel.Gemini38Flash]: "Gemini 3.8 Flash",
  [AgentModel.Gemini4Argon]: "Gemini 4 Argon",
  [AgentModel.Gemini4Carbon]: "Gemini 4 Carbon",
  [AgentModel.Gemini4Hydrogen]: "Gemini 4 Hydrogen",
  [AgentModel.MedGemma10_27B]: "MedGemma 27B",
  [AgentModel.Gemma4_26B]: "Gemma 4 26B",
  [AgentModel.Gemma4_31B]: "Gemma 4 31B",
  [AgentModel.MistralSmall31_24B]: "Mistral Small 3.1",
  [AgentModel.MistralSmall32_24B]: "Mistral Small 3.2",
  [AgentModel.Qwen38_27B]: "Qwen 3.8 27B",
  [AgentModel.ClaudeSonnet55]: "Claude Sonnet 5.5",
  [AgentModel.ClaudeHaiku55]: "Claude Haiku 5.5",
  [AgentModel.ClaudeOpus5]: "Claude Opus 5",
  [AgentModel.ClaudeOpus55]: "Claude Opus 5.5",
  [AgentModel.Gpt54]: "GPT-5.4",
  [AgentModel.Gpt54Mini]: "GPT-5.4 mini",
  [AgentModel._Mock]: "Test model",
} as const satisfies Record<AgentModel, string>

/**
 * The providers whose models take a service tier, priority or flex: Gemini 3.x and 4 (Vertex
 * AI's shared request type) and OpenAI (the service tier of the Responses API). Priority needs the
 * project's `llm-priority-calls` flag and the agent's toggle; flex needs the project's
 * `llm-flex-workers` flag and only applies to background jobs.
 */
const SERVICE_TIER_PROVIDERS: readonly AgentProvider[] = [
  AgentProvider.Vertex3,
  AgentProvider.Vertex4,
  AgentProvider.OpenAI,
]

/**
 * Models of a service tier provider that Google refuses on flex: Vertex AI answers a 400 "Flex
 * API is not supported for model" for every Gemini 4 model (probe of 2026-11-19). They still
 * take priority.
 */
const MODELS_WITHOUT_FLEX: readonly AgentModel[] = [
  AgentModel.Gemini4Argon,
  AgentModel.Gemini4Carbon,
  AgentModel.Gemini4Hydrogen,
]

/** Whether `model` can be called with a service tier (priority, and flex unless excluded). */
export function supportsServiceTiers(model: string | undefined): boolean {
  if (model === undefined || !(model in AgentModelToAgentProvider)) return false
  return SERVICE_TIER_PROVIDERS.includes(AgentModelToAgentProvider[model as AgentModel])
}

/** Whether `model` can be called with the flex tier (worker calls). */
export function supportsFlexTier(model: string | undefined): boolean {
  return supportsServiceTiers(model) && !MODELS_WITHOUT_FLEX.includes(model as AgentModel)
}

export type AgentModelOf<Provider extends AgentProvider> = {
  [Model in AgentModel]: (typeof AgentModelToAgentProvider)[Model] extends Provider ? Model : never
}[AgentModel]

export type AgentModelDeprecation = {
  /** ISO date (YYYY-MM-DD) on which the provider retires the model. */
  deprecatedOn: string
  recommendedReplacement: AgentModel
}

export type AgentModelDto = {
  model: AgentModel
  provider: AgentProvider
  isAvailable: boolean
  /** Runs on a vLLM server of the operator of the platform. */
  selfHosted: boolean
  deprecation: AgentModelDeprecation | null
  servedOutsideEu: boolean
  optionsSchema: Record<string, unknown>
  defaultOptions: Record<string, unknown>
}

/** A model the workspace added on a server of its own. Its server is never sent to the apps. */
export type AgentCustomModelDto = {
  id: string
  name: string
  /** The model of the code it runs: its options apply. */
  baseModel: AgentModel
}

export type AgentModelListDto = {
  /** Every model but the test one, available or not, in catalog order. */
  models: AgentModelDto[]
  /** The model a new agent starts on, and the one a new evaluation run is judged by. */
  defaults: { agent: AgentModel; judge: AgentModel }
  /** The models the workspace added, offered as more lines of the list. */
  customModels: AgentCustomModelDto[]
  /** Who runs the self-hosted models, for their badge. Null when the platform does not say. */
  selfHostedBy: string | null
}

/**
 * How a conversation agent uses its memory of a user (see ADR 0023).
 * - off: no memory tools, nothing remembered.
 * - ask: facts the user asks to remember are saved; facts the agent infers wait for the user's approval.
 * - auto: the agent saves both without asking.
 */
export enum AgentMemoryMode {
  Off = "off",
  Ask = "ask",
  Auto = "auto",
}

export enum DocumentsRagMode {
  All = "all",
  None = "none",
  Tags = "tags",
}

export type AgentMcpServerDto = {
  id: string
  name: string
  enabled: boolean
}

export type AgentSettingsDto = {
  agentId: string
  createdAt: TimeType
  description?: string
  documentsRagMode: DocumentsRagMode
  documentTagIds: DocumentTagDto["id"][]
  /** Embedding model the knowledge base lookup retrieves with. */
  embeddingModel: EmbeddingModel
  fillFormEnabled: boolean
  priorityCallsEnabled: boolean
  /** Set when the agent runs a model its workspace added; `model` is then that model's type. */
  customModelId: string | null
  greetingMessage?: string
  hasCategories?: boolean
  id: string
  instructions: string
  /**
   * Defaults of the {{variables}} the instructions declare: used by every channel
   * when it starts a session without a value for one of them.
   */
  variables: Record<string, string> | null
  isArchived: boolean
  isDraft: boolean
  /**
   * The saved revision every live channel runs with (Desk, embed, public API, sub-agents...).
   * Chosen by the agent's managers: saving a new revision does not move it, except the very
   * first one. At most one revision per agent carries it, and never the draft.
   */
  isProduction: boolean
  mcpServers: AgentMcpServerDto[]
  model: AgentModel
  name?: string
  outputJsonSchema?: Record<string, unknown>
  projectAgentSessionCategoryIds: string[]
  resourceLibraryIds: string[]
  revision: number
  providerOptions: Record<string, unknown>
  updatedAt: TimeType
  usedProjectAgentSessionCategoryIds: string[]
  memoryMode: AgentMemoryMode
  /** Whether the agent may end an answer with short follow-up questions the user can click. */
  followUpSuggestionsEnabled: boolean
  /** Extra guidance on when and how to write the follow-up questions. */
  followUpSuggestionsInstructions: string | null
  /** Most follow-up questions the agent may suggest after one answer. */
  followUpSuggestionsMax: number
}

// Constraint keywords (enum/minimum/maximum/items) mirror the subset of JSON Schema
// that Gemini/Vertex structured output understands. They are optional and not cross-checked
// against `type` (e.g. an enum on a number) — the provider is the authority on those pairings.
// `items` recurses so array properties can describe their element shape.
export const outputJsonSchemaPropertySchema = z.object({
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  description: z.string().optional(),
  enum: z.array(z.string()).min(1).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  get items() {
    return outputJsonSchemaPropertySchema.optional()
  },
})

export const outputJsonSchemaSchema = z
  .object({
    type: z.literal("object"),
    required: z.array(z.string()).optional(),
    properties: z.record(z.string(), outputJsonSchemaPropertySchema),
    // Author-controlled question order. `properties` is a map, so its key order is not
    // preserved through jsonb storage; `propertyOrdering` restores an explicit order and is
    // the native Gemini/Vertex ordering mechanism. Partial lists are allowed — unlisted keys
    // fall back to their `properties` key order. See `getOrderedPropertyEntries`.
    propertyOrdering: z.array(z.string()).optional(),
  })
  .refine((data) => {
    if (data.required) {
      return data.required.every((requiredKey) => requiredKey in data.properties)
    }
    return true
  }, "All required keys must be defined in properties")
  .refine((data) => {
    if (data.propertyOrdering) {
      return data.propertyOrdering.every((orderedKey) => orderedKey in data.properties)
    }
    return true
  }, "All propertyOrdering keys must be defined in properties")
  .refine(
    (data) =>
      Object.values(data.properties).every(
        (property) =>
          property.minimum === undefined ||
          property.maximum === undefined ||
          property.minimum <= property.maximum,
      ),
    "minimum must be less than or equal to maximum",
  )

type OutputJsonSchema = z.infer<typeof outputJsonSchemaSchema>
export type OutputJsonSchemaProperty = z.infer<typeof outputJsonSchemaPropertySchema>

/**
 * Returns `[key, property]` entries in the author-defined question order: keys listed in
 * `propertyOrdering` first (in that order), then any remaining `properties` keys in their
 * original insertion order. This is the single source of truth for fillForm question order.
 */
export function getOrderedPropertyEntries(
  schema: OutputJsonSchema,
): [string, OutputJsonSchemaProperty][] {
  const { properties, propertyOrdering } = schema
  if (!propertyOrdering || propertyOrdering.length === 0) {
    return Object.entries(properties)
  }

  const orderedKeys = propertyOrdering.filter((orderedKey) => orderedKey in properties)
  const seen = new Set(orderedKeys)
  const remainingKeys = Object.keys(properties).filter((key) => !seen.has(key))

  return [...orderedKeys, ...remainingKeys].map((key) => [key, properties[key]] as const) as [
    string,
    OutputJsonSchemaProperty,
  ][]
}

/** Highest value of `followUpSuggestionsMax`. */
export const FOLLOW_UP_SUGGESTIONS_MAX = 4
/** Value of `followUpSuggestionsMax` on a new agent. */
export const FOLLOW_UP_SUGGESTIONS_DEFAULT_MAX = 2
export const FOLLOW_UP_SUGGESTIONS_INSTRUCTIONS_MAX_LENGTH = 2000
/** Longest greeting an agent can send. The editor shows it next to the field. */
export const GREETING_MESSAGE_MAX_LENGTH = 2000

// Every editable agent field lives on a settings revision. This is the single source of truth
// for their validation; the create/update payload schemas below are all derived from it.
export const agentSettingsValidationSchema = z.object({
  greetingMessage: z.string().max(GREETING_MESSAGE_MAX_LENGTH).optional(),
  instructions: z.string(),
  documentTagIds: z.array(documentTagSchema.shape.id),
  documentsRagMode: z.enum(DocumentsRagMode),
  embeddingModel: z.enum(EmbeddingModel),
  fillFormEnabled: z.boolean(),
  priorityCallsEnabled: z.boolean(),
  model: z.enum(AgentModel),
  /** Set when the agent runs a model its workspace added; `model` is then that model's type. */
  customModelId: z.string().uuid().nullable().optional(),
  outputJsonSchema: outputJsonSchemaSchema.optional(),
  projectAgentSessionCategoryIds: z.array(z.string().uuid()),
  resourceLibraryIds: z.array(z.string().uuid()).optional(),
  memoryMode: z.enum(AgentMemoryMode),
  followUpSuggestionsEnabled: z.boolean(),
  followUpSuggestionsInstructions: z
    .string()
    .trim()
    .max(FOLLOW_UP_SUGGESTIONS_INSTRUCTIONS_MAX_LENGTH)
    .nullable(),
  followUpSuggestionsMax: z.number().int().min(1).max(FOLLOW_UP_SUGGESTIONS_MAX),
  providerOptions: z.record(z.string(), z.unknown()),
  // Defaults of the {{variables}} the instructions declare. Keys are the declared
  // variable names (the session-side resolution drops any value for an undeclared one).
  // Optional on the update payloads: omitting it keeps the stored defaults, `null` clears.
  variables: z.record(z.string(), z.string()).nullable().optional(),
})

export const refineFillFormOutputJsonSchema = {
  fn: (data: { fillFormEnabled?: boolean; outputJsonSchema?: Record<string, unknown> }) =>
    data.fillFormEnabled !== true || data.outputJsonSchema !== undefined,
  message: {
    message: "outputJsonSchema is required when the fillForm tool is enabled",
    path: ["outputJsonSchema"],
  },
}

export const hasRequiredDocumentTags = (data: {
  documentTagIds?: string[]
  documentsRagMode: DocumentsRagMode
  tagsToAdd?: string[]
}) =>
  data.documentsRagMode !== DocumentsRagMode.Tags ||
  (data.documentTagIds !== undefined
    ? data.documentTagIds.length > 0
    : (data.tagsToAdd?.length ?? 0) > 0)

export const updateAgentSettingsSchema = agentSettingsValidationSchema
  .pick({
    greetingMessage: true,
    instructions: true,
    documentTagIds: true,
    documentsRagMode: true,
    model: true,
    outputJsonSchema: true,
    projectAgentSessionCategoryIds: true,
    resourceLibraryIds: true,
  })
  .extend({
    tagsToAdd: updateDocumentTagsSchema.required().shape.tagsToAdd,
    tagsToRemove: updateDocumentTagsSchema.required().shape.tagsToRemove,
  })
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["documentTagIds"],
  })

export type UpdateAgentSettingsDto = z.infer<typeof updateAgentSettingsSchema>

export const updateAgentSettingsOutputSchema = z.object({
  outputJsonSchema: outputJsonSchemaSchema,
})

const greetingMessageUpdateSchema = z
  .string()
  .max(GREETING_MESSAGE_MAX_LENGTH)
  .nullable()
  .optional()

export const updateAgentSettingsGeneralSchema = agentSettingsValidationSchema
  .pick({ instructions: true, variables: true })
  .extend({
    name: z.string().trim().min(3).max(100),
    greetingMessage: greetingMessageUpdateSchema,
  })
export type UpdateAgentSettingsGeneralDto = z.infer<typeof updateAgentSettingsGeneralSchema>

export const updateAgentSettingsModelSchema = agentSettingsValidationSchema.pick({
  model: true,
  customModelId: true,
  providerOptions: true,
  priorityCallsEnabled: true,
  embeddingModel: true,
})
export type UpdateAgentSettingsModelDto = z.infer<typeof updateAgentSettingsModelSchema>

export type UpdateAgentSettingsOutputDto = z.infer<typeof updateAgentSettingsOutputSchema>

// The Sources tab edits what the agent answers from: its documents and its resource libraries.
export const updateAgentSettingsSourcesSchema = agentSettingsValidationSchema
  .pick({ documentsRagMode: true, documentTagIds: true })
  .extend({
    resourceLibraryIds: z.array(z.string().uuid()),
    tagsToAdd: updateDocumentTagsSchema.required().shape.tagsToAdd,
    tagsToRemove: updateDocumentTagsSchema.required().shape.tagsToRemove,
  })
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["documentTagIds"],
  })
export type UpdateAgentSettingsSourcesDto = z.infer<typeof updateAgentSettingsSourcesSchema>

export const updateAgentSettingsSourcesFormSchema = agentSettingsValidationSchema
  .pick({ documentsRagMode: true, documentTagIds: true })
  .extend({ resourceLibraryIds: z.array(z.string().uuid()) })
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["documentTagIds"],
  })
export type UpdateAgentSettingsSourcesFormDto = z.infer<typeof updateAgentSettingsSourcesFormSchema>

// The Tools tab toggles optional tools on a conversation agent. fillForm's form
// definition is the agent's outputJsonSchema; it must be present when the tool is
// enabled.
export const updateAgentSettingsToolsSchema = z
  .object({
    fillFormEnabled: agentSettingsValidationSchema.shape.fillFormEnabled,
    outputJsonSchema: outputJsonSchemaSchema.optional(),
    memoryMode: agentSettingsValidationSchema.shape.memoryMode.optional(),
    followUpSuggestionsEnabled:
      agentSettingsValidationSchema.shape.followUpSuggestionsEnabled.optional(),
    followUpSuggestionsInstructions:
      agentSettingsValidationSchema.shape.followUpSuggestionsInstructions.optional(),
    followUpSuggestionsMax: agentSettingsValidationSchema.shape.followUpSuggestionsMax.optional(),
  })
  .refine(refineFillFormOutputJsonSchema.fn, refineFillFormOutputJsonSchema.message)
export type UpdateAgentSettingsToolsDto = z.infer<typeof updateAgentSettingsToolsSchema>

export const updateAgentSettingsCategoriesSchema = agentSettingsValidationSchema.pick({
  projectAgentSessionCategoryIds: true,
})
export type UpdateAgentSettingsCategoriesDto = z.infer<typeof updateAgentSettingsCategoriesSchema>

// Server-side validation for the (partial) update endpoint: any subset of the tab fields.
export const partialUpdateAgentSettingsSchema = agentSettingsValidationSchema.partial().extend({
  greetingMessage: greetingMessageUpdateSchema,
  tagsToAdd: updateDocumentTagsSchema.required().shape.tagsToAdd.optional(),
  tagsToRemove: updateDocumentTagsSchema.required().shape.tagsToRemove.optional(),
})
export type PartialUpdateAgentSettingsDto = z.infer<typeof partialUpdateAgentSettingsSchema>

export const agentSettingsCreateSchema = z.object({
  revisionName: z.string().optional(),
  revisionDesc: z.string().optional(),
  /**
   * Also make the saved revision the production one. Ignored for the agent's first saved
   * revision, which always becomes production since there is nothing else to run.
   */
  setAsProduction: z.boolean().optional(),
})
export type CreateAgentSettingsDto = z.infer<typeof agentSettingsCreateSchema>
