import { z } from "zod"
import { updateDocumentTagsSchema } from "../document-tags/document-tag.dto"
import { type TimeType, timeTypeSchema } from "../generic"
import {
  agentSettingsValidationSchema,
  hasRequiredDocumentTags,
  refineFillFormOutputJsonSchema,
  refineOutputJsonSchema,
  refineResourceLibraries,
} from "./settings/agent-settings.dto"

export const agentTypeSchema = z.enum(["conversation", "extraction"])
export type AgentType = z.infer<typeof agentTypeSchema>

export type AgentDto = {
  createdAt: TimeType
  id: string
  name: string
  projectId: string
  type: AgentType
  currentRevision: {
    updatedAt: TimeType
    name?: string
    description?: string
    number: number
  }
}

export type AgentWithDraftDto = AgentDto & {
  draftRevision?: {
    updatedAt: TimeType
    name?: string
    description?: string
    number: number
  }
}

const agentSubAgentToolNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Tool name can only contain letters, numbers, underscores, and hyphens",
  })

// "relay" (default): the parent proxies every exchange with the sub-agent via a tool call.
// "handoff": once triggered, the end user talks directly to the sub-agent (its own real
// multi-turn session) until it hands back control, instead of the parent relaying each turn.
export const agentSubAgentModeSchema = z.enum(["relay", "handoff"])
export type AgentSubAgentMode = z.infer<typeof agentSubAgentModeSchema>

const replaceAgentSubAgentSchema = z.object({
  childAgentId: z.string().uuid(),
  toolName: agentSubAgentToolNameSchema,
  description: z.string().trim().max(2000).default(""),
  enabled: z.boolean(),
  mode: agentSubAgentModeSchema.default("relay"),
  // handoff mode only: whether the forced-conclusion classifier safety net applies to this
  // link. Default true (existing behavior). Set false for a sub-agent with no natural
  // finishing point (e.g. an open-ended Q&A agent that is the last workflow step), where a
  // single unhelpful reply should never be misread as "done" and force a handback.
  forceConclusionEnabled: z.boolean().default(true),
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
  mode: agentSubAgentModeSchema,
  forceConclusionEnabled: z.boolean(),
  childAgent: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      type: agentTypeSchema,
    })
    .optional(),
  createdAt: timeTypeSchema,
  updatedAt: timeTypeSchema,
})

export type ReplaceAgentSubAgentDto = z.infer<typeof replaceAgentSubAgentSchema>
export type ReplaceAgentSubAgentsDto = z.infer<typeof replaceAgentSubAgentsSchema>
export type AgentSubAgentDto = z.infer<typeof agentSubAgentSchema>

export const agentValidationSchema = z.object({
  name: z.string().trim().min(3),
  type: agentTypeSchema,
})

export const createAgentSchema = agentValidationSchema
  .pick({ type: true, name: true })
  .extend({
    ...agentSettingsValidationSchema.pick({
      documentsRagMode: true,
      greetingMessage: true,
      instructions: true,
      locale: true,
      model: true,
      outputJsonSchema: true,
      projectAgentSessionCategoryIds: true,
      resourceLibraryIds: true,
      temperature: true,
    }).shape,
    fillFormEnabled: agentSettingsValidationSchema.shape.fillFormEnabled.optional(),
    tagsToAdd: updateDocumentTagsSchema.required().shape.tagsToAdd,
  })
  .refine(refineOutputJsonSchema.fn, refineOutputJsonSchema.message)
  .refine(refineResourceLibraries.fn, refineResourceLibraries.message)
  .refine(refineFillFormOutputJsonSchema.fn, refineFillFormOutputJsonSchema.message)
  .refine(hasRequiredDocumentTags, {
    message: "At least one document tag is required when documentsRagMode is 'tags'",
    path: ["tagsToAdd"],
  })

export type CreateAgentDto = z.infer<typeof createAgentSchema>

export type UpdateAgentNameDto = z.infer<typeof updateAgentNameSchema>

export const updateAgentNameSchema = agentValidationSchema.pick({ name: true })
