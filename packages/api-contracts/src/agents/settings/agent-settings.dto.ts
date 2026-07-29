import { z } from "zod"
import type { TimeType } from "../../generic"
import {
  AgentLocale,
  AgentModel,
  type AgentTemperature,
  DocumentsRagMode,
  outputJsonSchemaSchema,
} from "../agents.dto"

export type AgentSettingsDto = {
  id: string
  agentId: string
  revision: number
  revisionName: string
  revisionDesc: string
  isDraft: boolean
  isArchived: boolean
  instructions: string
  greetingMessage?: string
  model: AgentModel
  temperature: AgentTemperature
  locale: AgentLocale
  documentsRagMode: DocumentsRagMode
  outputJsonSchema?: Record<string, unknown>
  fillFormEnabled: boolean
  createdAt: TimeType
  updatedAt: TimeType
}

// Every field is optional: each editor tab PATCHes only the fields it owns, and an omitted
// field must keep its current value rather than being wiped. Because of that, whether
// fillFormEnabled requires an outputJsonSchema can only be decided once the payload is merged
// with the current revision (a tab may enable fillForm while the schema was set by another tab
// in an earlier update) - the controller enforces that check, not this schema.
export const updateAgentSettingsSchema = z.object({
  instructions: z.string().optional(),
  // `null` clears the greeting; `undefined` leaves it untouched.
  greetingMessage: z.string().max(2000).nullable().optional(),
  model: z.enum(AgentModel).optional(),
  temperature: z.float32().min(0).max(2).optional(),
  locale: z.enum(AgentLocale).optional(),
  documentsRagMode: z.enum(DocumentsRagMode).optional(),
  outputJsonSchema: outputJsonSchemaSchema.optional(),
  fillFormEnabled: z.boolean().optional(),
})

export type UpdateAgentSettingsDto = z.infer<typeof updateAgentSettingsSchema>
