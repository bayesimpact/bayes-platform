import { z } from "zod"
import {
  type DocumentTagDto,
  documentTagSchema,
  updateDocumentTagsSchema,
} from "../../document-tags/document-tag.dto"
import type { TimeType } from "../../generic"
import { EmbeddingModel } from "../../project-embedding-models/project-embedding-models.dto"
import type { AgentDto, AgentType } from "../agents.dto"

export enum AgentModel {
  Gemini25Flash = "gemini-2.5-flash",
  Gemini25Pro = "gemini-2.5-pro",
  Gemini31FlashLite = "gemini-3.1-flash-lite",
  Gemini35FlashLite = "gemini-3.5-flash-lite",
  Gemini35Flash = "gemini-3.5-flash",
  Gemini36Flash = "gemini-3.6-flash",
  Gemini37Flash = "gemini-3.7-flash",
  Gemini38Flash = "gemini-3.8-flash",
  MedGemma10_27B = "google/medgemma-27b-it",
  Gemma4_26B = "google/gemma-4-26b-A4B-it",
  MistralSmall31_24B = "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
  _Mock = "mock-language-model-v3",
}

export enum AgentProvider {
  MedGemma = "MED-GEMMA",
  Gemma = "GEMMA",
  Vertex = "VERTEX",
  Mistral = "MISTRAL",
  Vertex3 = "VERTEX-3",
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
  [AgentModel.MedGemma10_27B]: AgentProvider.MedGemma,
  [AgentModel.Gemma4_26B]: AgentProvider.Gemma,
  [AgentModel.MistralSmall31_24B]: AgentProvider.Mistral,
  [AgentModel._Mock]: AgentProvider._Mock,
} as const satisfies Record<AgentModel, AgentProvider>

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
  deprecation: AgentModelDeprecation | null
  servedOutsideEu: boolean
  optionsSchema: Record<string, unknown>
  defaultOptions: Record<string, unknown>
}

export type AgentModelListDto = {
  /** Every model but the test one, available or not, in catalog order. */
  models: AgentModelDto[]
  /** The model a new agent starts on, and the one a new evaluation run is judged by. */
  defaults: { agent: AgentModel; judge: AgentModel }
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

export enum AgentLocale {
  EN = "en",
  FR = "fr",
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
  /** Embedding model the knowledge base lookup retrieves with. Absent means the Vertex default. */
  embeddingModel?: EmbeddingModel
  fillFormEnabled: boolean
  priorityCallsEnabled: boolean
  greetingMessage?: string
  hasCategories?: boolean
  id: string
  instructions: string
  isArchived: boolean
  isDraft: boolean
  locale: AgentLocale
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

// Every editable agent field lives on a settings revision. This is the single source of truth
// for their validation; the create/update payload schemas below are all derived from it.
export const agentSettingsValidationSchema = z.object({
  greetingMessage: z.string().max(2000).optional(),
  instructions: z.string(),
  documentTagIds: z.array(documentTagSchema.shape.id),
  documentsRagMode: z.enum(DocumentsRagMode),
  embeddingModel: z.enum(EmbeddingModel),
  fillFormEnabled: z.boolean(),
  locale: z.enum(AgentLocale),
  priorityCallsEnabled: z.boolean(),
  model: z.enum(AgentModel),
  outputJsonSchema: outputJsonSchemaSchema.optional(),
  projectAgentSessionCategoryIds: z.array(z.string().uuid()),
  resourceLibraryIds: z.array(z.string().uuid()).optional(),
  memoryMode: z.enum(AgentMemoryMode),
  providerOptions: z.record(z.string(), z.unknown()),
})

export const refineOutputJsonSchema = {
  fn: (data: { type: AgentDto["type"]; outputJsonSchema?: AgentSettingsDto["outputJsonSchema"] }) =>
    data.type === "conversation" || data.outputJsonSchema !== undefined,
  message: {
    message: "outputJsonSchema is required when type is not 'conversation'",
    path: ["outputJsonSchema"],
  },
}

export const refineResourceLibraries = {
  fn: (data: { type?: AgentType; resourceLibraryIds?: string[] }) =>
    (data.resourceLibraryIds?.length ?? 0) === 0 || data.type === "conversation",
  message: {
    message: "Resource libraries can only be attached to conversation agents",
    path: ["resourceLibraryIds"],
  },
}

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
    locale: true,
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

const greetingMessageUpdateSchema = z.string().max(2000).nullable().optional()

export const updateAgentSettingsGeneralSchema = agentSettingsValidationSchema
  .pick({ locale: true, instructions: true })
  .extend({
    name: z.string().trim().min(3).max(100),
    greetingMessage: greetingMessageUpdateSchema,
  })
export type UpdateAgentSettingsGeneralDto = z.infer<typeof updateAgentSettingsGeneralSchema>

export const updateAgentSettingsModelSchema = agentSettingsValidationSchema.pick({
  model: true,
  providerOptions: true,
  priorityCallsEnabled: true,
  embeddingModel: true,
})
export type UpdateAgentSettingsModelDto = z.infer<typeof updateAgentSettingsModelSchema>

export type UpdateAgentSettingsOutputDto = z.infer<typeof updateAgentSettingsOutputSchema>

export const updateAgentSettingsSourcesSchema = agentSettingsValidationSchema
  .pick({ documentsRagMode: true, documentTagIds: true })
  .extend({
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
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["documentTagIds"],
  })
export type UpdateAgentSettingsSourcesFormDto = z.infer<typeof updateAgentSettingsSourcesFormSchema>

export const updateAgentSettingsResourcesSchema = agentSettingsValidationSchema
  .pick({ resourceLibraryIds: true })
  .extend({ resourceLibraryIds: z.array(z.string().uuid()) })
export type UpdateAgentSettingsResourcesDto = z.infer<typeof updateAgentSettingsResourcesSchema>

// The Tools tab toggles optional tools on a conversation agent. fillForm's form
// definition is the agent's outputJsonSchema; it must be present when the tool is
// enabled.
export const updateAgentSettingsToolsSchema = z
  .object({
    fillFormEnabled: agentSettingsValidationSchema.shape.fillFormEnabled,
    outputJsonSchema: outputJsonSchemaSchema.optional(),
    memoryMode: agentSettingsValidationSchema.shape.memoryMode.optional(),
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
})
export type CreateAgentSettingsDto = z.infer<typeof agentSettingsCreateSchema>
