import { z } from "zod"
import type { TimeType } from "../generic"

export type McpServerDto = {
  id: string
  name: string
  url: string
  projectId: string
  createdAt: TimeType
  updatedAt: TimeType
}

export const createMcpServerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().url(),
  apiKey: z.string().optional(),
})

export type CreateMcpServerDto = z.infer<typeof createMcpServerSchema>
