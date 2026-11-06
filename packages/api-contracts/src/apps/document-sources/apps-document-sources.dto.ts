import { z } from "zod"
import type { TimeType } from "../../generic"

const optionalText = z.string().trim().min(1).max(500).nullable().optional()

export const createDocumentSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: optionalText,
    external_id: optionalText,
    base_url: z.string().url().nullable().optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
    /**
     * Names of the tags the new source starts with. A top-level tag of that name is reused, or
     * created. Read on create only: after that, the workspace owns the tags of the source.
     */
    tags: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  })
  .strict()

export type CreateDocumentSourceRequestDto = z.infer<typeof createDocumentSourceSchema>

export const updateDocumentSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()

export type UpdateDocumentSourceRequestDto = z.infer<typeof updateDocumentSourceSchema>

export type DocumentSourceDto = {
  id: string
  name: string
  type: string | null
  externalId: string | null
  baseUrl: string | null
  createdAt: TimeType
  updatedAt: TimeType
}
