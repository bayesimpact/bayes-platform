import { z } from "zod"

/** The params of the routes under one document of a project. */
export const documentParamsSchema = z.strictObject({
  organizationId: z.uuid(),
  projectId: z.uuid(),
  documentId: z.uuid(),
})

/** Whether a document is shared with every member of the project, who can then download it. */
export const documentIsPublicOutputSchema = z.object({
  isPublicDocument: z.boolean(),
})

/** A short-lived URL to download a file. */
export const temporaryUrlOutputSchema = z.object({
  url: z.url(),
})
