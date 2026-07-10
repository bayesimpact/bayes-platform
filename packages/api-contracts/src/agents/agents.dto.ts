import { z } from "zod"
import {
  type DocumentTagDto,
  documentTagSchema,
  updateDocumentTagsSchema,
} from "../document-tags/document-tag.dto"
import { type TimeType, timeTypeSchema } from "../generic"

export enum AgentModel {
  Gemini25Flash = "gemini-2.5-flash",
  Gemini25Pro = "gemini-2.5-pro",
  Gemini31FlashLite = "gemini-3.1-flash-lite",
  Gemini35Flash = "gemini-3.5-flash",
  MedGemma10_27B = "google/medgemma-27b-it",
  Gemma4_26B = "google/gemma-4-26b-A4B-it",
  MistralSmall31_24B = "mistralai/Mistral-Small-3.1-24B-Instruct-2503",
  _MockGenerateObject = "generate-object-mock-language-model-v3",
  _MockGenerateStructuredOutput = "generate-structured-output-mock-language-model-v3",
  _MockGenerateText = "generate-text-mock-language-model-v3",
  _MockRate = "rate-mock-language-model-v3",
  _MockStreamChatResponse = "stream-chat-response-mock-language-model-v3",
}

export enum AgentProvider {
  MedGemma = "MED-GEMMA",
  Gemma = "GEMMA",
  Vertex = "VERTEX",
  Mistral = "MISTRAL",
  Vertex3 = "VERTEX-3",
  _Mock = "MOCK",
}
export const AgentModelToAgentProvider: Record<AgentModel, AgentProvider> = {
  [AgentModel.Gemini25Flash]: AgentProvider.Vertex,
  [AgentModel.Gemini25Pro]: AgentProvider.Vertex,
  [AgentModel.Gemini31FlashLite]: AgentProvider.Vertex3,
  [AgentModel.Gemini35Flash]: AgentProvider.Vertex3,
  [AgentModel.MedGemma10_27B]: AgentProvider.MedGemma,
  [AgentModel.Gemma4_26B]: AgentProvider.Gemma,
  [AgentModel.MistralSmall31_24B]: AgentProvider.Mistral,
  [AgentModel._MockGenerateObject]: AgentProvider._Mock,
  [AgentModel._MockGenerateStructuredOutput]: AgentProvider._Mock,
  [AgentModel._MockGenerateText]: AgentProvider._Mock,
  [AgentModel._MockRate]: AgentProvider._Mock,
  [AgentModel._MockStreamChatResponse]: AgentProvider._Mock,
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

export type AgentDto = {
  createdAt: TimeType
  greetingMessage?: string
  instructions: string
  hasCategories?: boolean
  id: string
  revision: number
  locale: AgentLocale
  model: AgentModel
  name: string
  outputJsonSchema?: Record<string, unknown>
  projectId: string
  temperature: AgentTemperature
  type: AgentType
  updatedAt: TimeType
  documentTagIds: DocumentTagDto["id"][]
  documentsRagMode: DocumentsRagMode
  projectAgentSessionCategoryIds: string[]
  usedProjectAgentSessionCategoryIds: string[]
  resourceLibraryIds: string[]
}

export const outputJsonSchemaSchema = z
  .object({
    type: z.literal("object"),
    required: z.array(z.string()).optional(),
    properties: z.record(
      z.string(),
      z.object({
        type: z.enum(["string", "number", "boolean", "object", "array"]),
        description: z.string().optional(),
      }),
    ),
  })
  .refine((data) => {
    if (data.required) {
      return data.required.every((requiredKey) => requiredKey in data.properties)
    }
    return true
  }, "All required keys must be defined in properties")

const agentValidationSchema = z.object({
  greetingMessage: z.string().max(2000).optional(),
  instructions: z.string(),
  documentTagIds: z.array(documentTagSchema.shape.id),
  documentsRagMode: z.enum(DocumentsRagMode),
  locale: z.enum(AgentLocale),
  model: z.enum(AgentModel),
  name: z.string().trim().min(3),
  outputJsonSchema: outputJsonSchemaSchema.optional(),
  projectAgentSessionCategoryIds: z.array(z.string().uuid()),
  resourceLibraryIds: z.array(z.string().uuid()).optional(),
  temperature: z
    .float32()
    .min(0)
    .max(2)
    .refine(
      (temperatureValue) =>
        temperatureValue >= 0 && temperatureValue <= 2 && Number.isFinite(temperatureValue),
      "Temperature must be between 0.0 and 2.0",
    ),
  type: z.enum(["conversation", "extraction", "form"]),
})

export type AgentType = z.infer<typeof agentValidationSchema.shape.type>
export type AgentTemperature = z.infer<typeof agentValidationSchema.shape.temperature>

const agentSubAgentToolNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Tool name can only contain letters, numbers, underscores, and hyphens",
  })

const replaceAgentSubAgentSchema = z.object({
  childAgentId: z.string().uuid(),
  toolName: agentSubAgentToolNameSchema,
  description: z.string().trim().max(2000).default(""),
  enabled: z.boolean(),
})

export const replaceAgentSubAgentsSchema = z.object({
  subAgents: z.array(replaceAgentSubAgentSchema).max(20),
})

export const agentSubAgentSchema = z.object({
  id: z.string().uuid(),
  parentAgentId: z.string().uuid(),
  childAgentId: z.string().uuid(),
  toolName: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  childAgent: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      type: agentValidationSchema.shape.type,
    })
    .optional(),
  createdAt: timeTypeSchema,
  updatedAt: timeTypeSchema,
})

export type ReplaceAgentSubAgentDto = z.infer<typeof replaceAgentSubAgentSchema>
export type ReplaceAgentSubAgentsDto = z.infer<typeof replaceAgentSubAgentsSchema>
export type AgentSubAgentDto = z.infer<typeof agentSubAgentSchema>

const refineOutputJsonSchema = {
  fn: (data: Partial<AgentDto>) =>
    data.type === "conversation" || data.outputJsonSchema !== undefined,
  message: {
    message: "outputJsonSchema is required when type is not 'conversation'",
    path: ["outputJsonSchema"],
  },
}

const refineResourceLibraries = {
  fn: (data: { type?: AgentType; resourceLibraryIds?: string[] }) =>
    (data.resourceLibraryIds?.length ?? 0) === 0 ||
    data.type === "conversation" ||
    data.type === "form",
  message: {
    message: "Resource libraries can only be attached to conversation or form agents",
    path: ["resourceLibraryIds"],
  },
}

const hasRequiredDocumentTags = (data: {
  documentTagIds?: string[]
  documentsRagMode: DocumentsRagMode
  tagsToAdd?: string[]
}) =>
  data.documentsRagMode !== DocumentsRagMode.Tags ||
  (data.documentTagIds !== undefined
    ? data.documentTagIds.length > 0
    : (data.tagsToAdd?.length ?? 0) > 0)

export const createAgentSchema = agentValidationSchema
  .pick({
    greetingMessage: true,
    instructions: true,
    documentsRagMode: true,
    locale: true,
    model: true,
    name: true,
    outputJsonSchema: true,
    projectAgentSessionCategoryIds: true,
    resourceLibraryIds: true,
    temperature: true,
    type: true,
  })
  .extend({
    tagsToAdd: updateDocumentTagsSchema.required().shape.tagsToAdd,
  })
  .refine(refineOutputJsonSchema.fn, refineOutputJsonSchema.message)
  .refine(refineResourceLibraries.fn, refineResourceLibraries.message)
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["tagsToAdd"],
  })

export const updateAgentSchema = agentValidationSchema
  .pick({
    greetingMessage: true,
    instructions: true,
    documentTagIds: true,
    documentsRagMode: true,
    locale: true,
    model: true,
    name: true,
    outputJsonSchema: true,
    projectAgentSessionCategoryIds: true,
    resourceLibraryIds: true,
    temperature: true,
  })
  .extend({
    tagsToAdd: updateDocumentTagsSchema.required().shape.tagsToAdd,
    tagsToRemove: updateDocumentTagsSchema.required().shape.tagsToRemove,
  })
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["documentTagIds"],
  })

export type CreateAgentDto = z.infer<typeof createAgentSchema>
export type UpdateAgentDto = z.infer<typeof updateAgentSchema>

// Per-tab update schemas. Each agent editor tab owns and validates only its own fields,
// and PATCHes a partial payload (the update endpoint applies fields independently).
const greetingMessageUpdateSchema = z.string().max(2000).nullable().optional()

export const updateAgentGeneralSchema = agentValidationSchema
  .pick({ name: true, locale: true, instructions: true })
  .extend({ greetingMessage: greetingMessageUpdateSchema })

export const updateAgentModelSchema = agentValidationSchema.pick({
  model: true,
  temperature: true,
})

export const updateAgentOutputSchema = z.object({ outputJsonSchema: outputJsonSchemaSchema })

export const updateAgentSourcesSchema = agentValidationSchema
  .pick({ documentsRagMode: true, documentTagIds: true })
  .extend({
    tagsToAdd: updateDocumentTagsSchema.required().shape.tagsToAdd,
    tagsToRemove: updateDocumentTagsSchema.required().shape.tagsToRemove,
  })
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["documentTagIds"],
  })

// The Sources tab edits the desired final tag set; it derives `tagsToAdd`/`tagsToRemove`
// (what the API actually consumes) from the original agent tags at submit time.
export const updateAgentSourcesFormSchema = agentValidationSchema
  .pick({ documentsRagMode: true, documentTagIds: true })
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["documentTagIds"],
  })

export const updateAgentResourcesSchema = agentValidationSchema
  .pick({ resourceLibraryIds: true })
  .extend({ resourceLibraryIds: z.array(z.string().uuid()) })

export const updateAgentCategoriesSchema = agentValidationSchema.pick({
  projectAgentSessionCategoryIds: true,
})

// Server-side validation for the (partial) update endpoint: any subset of the tab fields.
export const partialUpdateAgentSchema = agentValidationSchema.partial().extend({
  greetingMessage: greetingMessageUpdateSchema,
  tagsToAdd: updateDocumentTagsSchema.required().shape.tagsToAdd.optional(),
  tagsToRemove: updateDocumentTagsSchema.required().shape.tagsToRemove.optional(),
})

export type UpdateAgentGeneralDto = z.infer<typeof updateAgentGeneralSchema>
export type UpdateAgentModelDto = z.infer<typeof updateAgentModelSchema>
export type UpdateAgentOutputDto = z.infer<typeof updateAgentOutputSchema>
export type UpdateAgentSourcesDto = z.infer<typeof updateAgentSourcesSchema>
export type UpdateAgentSourcesFormDto = z.infer<typeof updateAgentSourcesFormSchema>
export type UpdateAgentResourcesDto = z.infer<typeof updateAgentResourcesSchema>
export type UpdateAgentCategoriesDto = z.infer<typeof updateAgentCategoriesSchema>
export type PartialUpdateAgentDto = z.infer<typeof partialUpdateAgentSchema>
