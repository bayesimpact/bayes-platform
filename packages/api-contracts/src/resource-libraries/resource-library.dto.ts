import { z } from "zod"
import type { TimeType } from "../generic"

export const resourceFileSchema = z.object({
  storageRelativePath: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
})

export type ResourceFileDto = z.infer<typeof resourceFileSchema>

export const resourceSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000),
    // Optional, LLM-only matching context: never rendered to users, only fed to the agent to
    // improve which requests surface this resource (keywords, synonyms, "use when…" guidance).
    matchingHints: z.string().trim().max(1000).optional(),
    linkType: z.enum(["url", "file"]),
    url: z.string().url().optional(),
    file: resourceFileSchema.optional(),
  })
  .refine(
    (resource) =>
      resource.linkType === "url"
        ? resource.url !== undefined && resource.file === undefined
        : resource.file !== undefined && resource.url === undefined,
    {
      message:
        "A resource must provide a url when linkType is 'url', or a file when linkType is 'file'",
      path: ["linkType"],
    },
  )

export type ResourceDto = z.infer<typeof resourceSchema>

export const resourceLibraryFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  resources: z.array(resourceSchema).max(100).default([]),
})

export const createResourceLibrarySchema = resourceLibraryFieldsSchema
export const updateResourceLibrarySchema = resourceLibraryFieldsSchema

export type CreateResourceLibraryDto = z.infer<typeof createResourceLibrarySchema>
export type UpdateResourceLibraryDto = z.infer<typeof updateResourceLibrarySchema>

export type ResourceLibraryDto = {
  id: string
  title: string
  resources: ResourceDto[]
  organizationId: string
  projectId: string
  createdAt: TimeType
  updatedAt: TimeType
}

export const uploadResourceFileResponseSchema = resourceFileSchema
export type UploadResourceFileResponseDto = ResourceFileDto
