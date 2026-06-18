import { z } from "zod"
import type { TimeType } from "../generic"

export const resourceFileSchema = z.object({
  storageRelativePath: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
})

export type ResourceFileDto = z.infer<typeof resourceFileSchema>

// Character limits for the editable resource fields. Exported so the web form can surface them as
// hints/inline errors and validate before submitting — keeping client and server in lockstep.
export const RESOURCE_FIELD_LIMITS = {
  title: { min: 1, max: 200 },
  description: { max: 2000 },
  matchingHints: { max: 1000 },
} as const

// Editable fields of a resource. The `id` is server-managed, so it is not part of the create/update
// payloads — it is assigned on creation and taken from the path on update.
const resourceFieldsObject = z.object({
  title: z
    .string()
    .trim()
    .min(RESOURCE_FIELD_LIMITS.title.min)
    .max(RESOURCE_FIELD_LIMITS.title.max),
  description: z.string().trim().max(RESOURCE_FIELD_LIMITS.description.max),
  // Optional, LLM-only matching context: never rendered to users, only fed to the agent to
  // improve which requests surface this resource (keywords, synonyms, "use when…" guidance).
  matchingHints: z.string().trim().max(RESOURCE_FIELD_LIMITS.matchingHints.max).optional(),
  linkType: z.enum(["url", "file"]),
  url: z.url().optional(),
  file: resourceFileSchema.optional(),
})

const hasMatchingLink = (resource: z.infer<typeof resourceFieldsObject>): boolean =>
  resource.linkType === "url"
    ? resource.url !== undefined && resource.file === undefined
    : resource.file !== undefined && resource.url === undefined

const resourceLinkRefinementOptions = {
  message:
    "A resource must provide a url when linkType is 'url', or a file when linkType is 'file'",
  path: ["linkType"],
}

export const resourceSchema = resourceFieldsObject
  .extend({ id: z.string().uuid() })
  .refine(hasMatchingLink, resourceLinkRefinementOptions)

export type ResourceDto = z.infer<typeof resourceSchema>

export const createResourceSchema = resourceFieldsObject.refine(
  hasMatchingLink,
  resourceLinkRefinementOptions,
)
export const updateResourceSchema = resourceFieldsObject.refine(
  hasMatchingLink,
  resourceLinkRefinementOptions,
)

export type CreateResourceDto = z.infer<typeof createResourceSchema>
export type UpdateResourceDto = z.infer<typeof updateResourceSchema>

// Creating or updating a library only requires its name. Resources are managed through the
// dedicated add/update/delete resource endpoints.
export const resourceLibraryFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
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
