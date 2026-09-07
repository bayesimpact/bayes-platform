import { z } from "zod"
import type { TimeType } from "../generic"

export type McpServerDto = {
  id: string
  name: string
  url: string
  /** Null for built-in servers, which are visible in every project. */
  projectId: string | null
  /** Provided by the platform: cannot be edited or deleted, only toggled per agent. */
  isBuiltIn: boolean
  createdAt: TimeType
  updatedAt: TimeType
}

export const createMcpServerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().url(),
  apiKey: z.string().optional(),
  /**
   * Static headers sent on every call to this server, for whatever it expects
   * beyond its auth (an API version, a tenant).
   */
  headers: z.record(z.string().trim().min(1), z.string()).optional(),
})

export type CreateMcpServerDto = z.infer<typeof createMcpServerSchema>
