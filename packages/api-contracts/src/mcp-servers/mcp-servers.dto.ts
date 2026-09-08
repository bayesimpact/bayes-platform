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
  authStatus: McpServerAuthStatus
  createdAt: TimeType
  updatedAt: TimeType
}

export const MCP_AUTH_METHODS = ["apiKey", "oauth", "none"] as const
export type McpServerAuthMethod = (typeof MCP_AUTH_METHODS)[number]

export const createMcpServerSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    url: z.string().url(),
    /** Authentication mechanism chosen at creation. Defaults to apiKey/none by inference when absent. */
    authMethod: z.enum(MCP_AUTH_METHODS).optional(),
    apiKey: z.string().optional(),
    /**
     * Static headers sent on every call to this server, for whatever it expects
     * beyond its auth (an API version, a tenant).
     */
    headers: z.record(z.string().trim().min(1), z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.authMethod === "apiKey" && !data.apiKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message: "An API key is required when the authentication method is API key.",
      })
    }
  })

export type CreateMcpServerDto = z.infer<typeof createMcpServerSchema>

export type McpServerAuthStatus = "none" | "apiKey" | "oauthPending" | "oauthConnected"

export type McpServerOauthInitiationDto = {
  authorizationUrl: string
}

export const completeMcpServerOauthSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

export type CompleteMcpServerOauthDto = z.infer<typeof completeMcpServerOauthSchema>
