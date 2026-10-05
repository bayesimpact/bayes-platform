import { z } from "zod"
import type { TimeType } from "../../generic"

const optionalDescription = z.string().trim().max(2000).nullable().optional()
const optionalParentId = z.string().uuid().nullable().optional()

export const createAppDocumentTagSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: optionalDescription,
    parent_id: optionalParentId,
  })
  .strict()

export type CreateAppDocumentTagRequestDto = z.infer<typeof createAppDocumentTagSchema>

export const updateAppDocumentTagSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: optionalDescription,
    parent_id: optionalParentId,
  })
  .strict()

export type UpdateAppDocumentTagRequestDto = z.infer<typeof updateAppDocumentTagSchema>

export type AppDocumentTagDto = {
  id: string
  name: string
  description: string | null
  parentId: string | null
  createdAt: TimeType
  updatedAt: TimeType
}
