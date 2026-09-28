import { z } from "zod"

export const createAppDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    content: z.string().min(1),
    source_url: z.string().url().optional(),
  })
  .strict()

export type CreateAppDocumentRequestDto = z.infer<typeof createAppDocumentSchema>

export type CreateAppDocumentResponseDto = {
  id: string
  title: string
  projectId: string
  sourceUrl: string | null
  embeddingStatus: "pending" | "queued" | "processing" | "completed" | "failed"
}
