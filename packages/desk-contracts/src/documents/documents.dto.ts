import { z } from "zod"
import { projectParamsSchema } from "../common/params.dto"

/** The params of the routes under one document of a project. */
export const documentParamsSchema = projectParamsSchema.extend({ documentId: z.uuid() })

export type DocumentParamsDto = z.output<typeof documentParamsSchema>

/** Whether a document is shared with every member of the project, who can then download it. */
export const documentIsPublicOutputSchema = z.object({
  isPublicDocument: z.boolean(),
})

/** A short-lived URL to download a file. */
export const temporaryUrlOutputSchema = z.object({
  url: z.url(),
})
