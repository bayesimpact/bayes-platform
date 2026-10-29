import { z } from "zod"
import { updateDocumentTagsSchema } from "../document-tags/document-tag.dto"
import { type TimeType, timeTypeSchema } from "../generic"
import type { AgentPermission } from "../rbac/permissions"
import {
  agentSettingsValidationSchema,
  hasRequiredDocumentTags,
  refineFillFormOutputJsonSchema,
  refineOutputJsonSchema,
  refineResourceLibraries,
} from "./settings/agent-settings.dto"

export const agentTypeSchema = z.enum(["conversation", "extraction"])
export type AgentType = z.infer<typeof agentTypeSchema>

export type AgentRevisionDto = {
  updatedAt: TimeType
  name?: string
  description?: string
  number: number
}

export type AgentDto = {
  createdAt: TimeType
  id: string
  name: string
  projectId: string
  type: AgentType
  currentRevision: AgentRevisionDto
  /** The caller's permissions on the agent, limited to `AGENT_SCOPED_PERMISSIONS`. */
  permissions: AgentPermission[]
}

/**
 * An agent as the studio sees it. `currentRevision` is the published revision: it is missing
 * while the agent was never published, as a copy that starts as a draft.
 */
export type AgentWithDraftDto = Omit<AgentDto, "currentRevision"> & {
  currentRevision?: AgentRevisionDto
  draftRevision?: AgentRevisionDto
}

const agentSubAgentToolNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Tool name can only contain letters, numbers, underscores, and hyphens",
  })

/**
 * How a parent agent uses a sub-agent.
 * - "relay": the parent calls the sub-agent as a tool for one exchange and answers the user itself.
 * - "handoff": the sub-agent takes the conversation over. The user's next messages go to it
 *   directly, in the same session, until it concludes and hands the conversation back.
 */
export const agentSubAgentModeSchema = z.enum(["relay", "handoff"])
export type AgentSubAgentMode = z.infer<typeof agentSubAgentModeSchema>

const replaceAgentSubAgentSchema = z.object({
  childAgentId: z.string().uuid(),
  toolName: agentSubAgentToolNameSchema,
  description: z.string().trim().max(2000).default(""),
  enabled: z.boolean(),
  mode: agentSubAgentModeSchema.default("relay"),
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

/** Request shape: `mode` may be omitted and defaults to "relay". */
export type ReplaceAgentSubAgentDto = z.input<typeof replaceAgentSubAgentSchema>
export type ReplaceAgentSubAgentsDto = z.input<typeof replaceAgentSubAgentsSchema>
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
      model: true,
      outputJsonSchema: true,
      projectAgentSessionCategoryIds: true,
      resourceLibraryIds: true,
    }).shape,
    fillFormEnabled: agentSettingsValidationSchema.shape.fillFormEnabled.optional(),
    // The model's defaults when left out.
    providerOptions: agentSettingsValidationSchema.shape.providerOptions.optional(),
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

/**
 * The settings a copy starts from: the published revision the agent runs with, or the draft its
 * editor shows. An agent without a draft gives its published revision, and one never published
 * gives its draft, whatever the choice.
 */
export const agentDuplicationSourceSchema = z.enum(["published", "draft"])

export type AgentDuplicationSource = z.infer<typeof agentDuplicationSourceSchema>

/** The name of the copy and the settings it starts from: the rest comes from the original. */
export const duplicateAgentSchema = agentValidationSchema.pick({ name: true }).extend({
  source: agentDuplicationSourceSchema.default("published"),
})

// Input type: a client may leave the source out.
export type DuplicateAgentDto = z.input<typeof duplicateAgentSchema>
