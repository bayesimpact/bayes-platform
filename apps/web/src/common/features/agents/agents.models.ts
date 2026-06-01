import type { AgentDto } from "@caseai-connect/api-contracts"
import z from "zod"

export type Agent = AgentDto

export const agentSchema = z
  .object({
    createdAt: z.number(),
    instructions: z.string(),
    documentsRagMode: z.enum(["all", "none", "tags"]),
    hasCategories: z.boolean().optional(),
    id: z.string(),
    locale: z.string(),
    model: z.string(),
    name: z.string(),
    temperature: z.number(),
    updatedAt: z.number(),
    documentTags: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  })
  .strict()
