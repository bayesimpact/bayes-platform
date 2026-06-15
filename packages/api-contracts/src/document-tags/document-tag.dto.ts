import { z } from "zod"
import { type TimeType, timeTypeSchema } from "../generic"

export const PUBLIC_DOCUMENTS_TAG_NAME = "public-documents"

export const documentTagSchema = z.object({
  childrenIds: z.array(z.string()),
  createdAt: timeTypeSchema,
  description: z.string().optional(),
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  parentId: z.string().optional(),
  projectId: z.string(),
  updatedAt: timeTypeSchema,
})

export type DocumentTagDto = {
  childrenIds: DocumentTagDto["id"][]
  createdAt: TimeType
  description?: string
  id: string
  name: string
  organizationId: string
  parentId?: DocumentTagDto["id"]
  projectId: string
  updatedAt: TimeType
}

export const updateDocumentTagsSchema = z.object({
  tagsToAdd: z.array(documentTagSchema.shape.id).optional(),
  tagsToRemove: z.array(documentTagSchema.shape.id).optional(),
})

export type DocumentTagsUpdateFieldsDto = z.infer<typeof updateDocumentTagsSchema>
