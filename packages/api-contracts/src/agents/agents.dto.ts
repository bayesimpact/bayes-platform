import { z } from "zod"
import {
  type DocumentTagDto,
  documentTagSchema,
  updateDocumentTagsSchema,
} from "../document-tags/document-tag.dto"
import { timeTypeSchema, type TimeType } from "../generic"

export enum AgentModel {
  Gemini25Flash = "gemini-2.5-flash",
  Gemini25Pro = "gemini-2.5-pro",
  MedGemma10_27B = "google/medgemma-27b-it",
  Gemma4_26B = "google/gemma-4-26b-A4B-it",
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
  _Mock = "MOCK",
}
export const AgentModelToAgentProvider: Record<AgentModel, AgentProvider> = {
  [AgentModel.Gemini25Flash]: AgentProvider.Vertex,
  [AgentModel.Gemini25Pro]: AgentProvider.Vertex,
  [AgentModel.MedGemma10_27B]: AgentProvider.MedGemma,
  [AgentModel.Gemma4_26B]: AgentProvider.Gemma,
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
  greetingMessage?: string | null
  defaultPrompt: string
  hasCategories?: boolean
  id: string
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
  projectAgentCategoryIds: string[]
  usedProjectAgentCategoryIds: string[]
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
  greetingMessage: z.string().max(2000).nullable().optional(),
  defaultPrompt: z.string(),
  documentTagIds: z.array(documentTagSchema.shape.id),
  documentsRagMode: z.enum(DocumentsRagMode),
  locale: z.enum(AgentLocale),
  model: z.enum(AgentModel),
  name: z.string().trim().min(3),
  outputJsonSchema: outputJsonSchemaSchema.optional(),
  projectAgentCategoryIds: z.array(z.string().uuid()),
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
    defaultPrompt: true,
    documentsRagMode: true,
    locale: true,
    model: true,
    name: true,
    outputJsonSchema: true,
    projectAgentCategoryIds: true,
    temperature: true,
    type: true,
  })
  .extend({
    tagsToAdd: updateDocumentTagsSchema.required().shape.tagsToAdd,
  })
  .refine(refineOutputJsonSchema.fn, refineOutputJsonSchema.message)
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["tagsToAdd"],
  })

export const updateAgentSchema = agentValidationSchema
  .pick({
    greetingMessage: true,
    defaultPrompt: true,
    documentTagIds: true,
    documentsRagMode: true,
    locale: true,
    model: true,
    name: true,
    outputJsonSchema: true,
    projectAgentCategoryIds: true,
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
