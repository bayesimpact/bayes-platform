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
  authMethod: McpServerAuthMethod
  authStatus: McpServerAuthStatus
  /**
   * Names of the static headers sent to this server. Their values can hold a
   * secret, so they never leave the API.
   */
  headerNames: string[]
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

/**
 * Every field is optional: an absent field keeps its stored value.
 * The API key and the header values are write-only, so the edit form cannot
 * send them back: an empty `apiKey` keeps the stored key, and a header whose
 * value is `null` keeps its stored value. A header name left out is removed.
 */
export const updateMcpServerSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  url: z.string().url().optional(),
  authMethod: z.enum(MCP_AUTH_METHODS).optional(),
  apiKey: z.string().optional(),
  headers: z.record(z.string().trim().min(1), z.string().nullable()).optional(),
})

export type UpdateMcpServerDto = z.infer<typeof updateMcpServerSchema>

/**
 * `oauthPending`: never authorized. `oauthExpired`: authorized once, but the
 * tokens can no longer authenticate, so someone must authorize again.
 */
export type McpServerAuthStatus =
  | "none"
  | "apiKey"
  | "oauthPending"
  | "oauthConnected"
  | "oauthExpired"

export type McpServerConnectionStatus = "connected" | "authorizationRequired" | "failed"

export const MCP_SERVER_CONNECTION_ERROR_CODES = [
  /** 401: the server refused the credentials, or expects some. */
  "unauthorized",
  /** 403: the credentials are valid but may not use this endpoint. */
  "forbidden",
  /** 404 or 405: nothing speaks MCP over HTTP at this path. */
  "notFound",
  /** Any other HTTP error status. */
  "httpError",
  /** DNS failure, refused connection, TLS error. */
  "unreachable",
  "timeout",
  /** The host answered, but not with the MCP protocol. */
  "notMcp",
  /** The URL is not public https, so the platform refuses to call it. */
  "urlNotAllowed",
  "unknown",
] as const
export type McpServerConnectionErrorCode = (typeof MCP_SERVER_CONNECTION_ERROR_CODES)[number]

export type McpServerConnectionErrorDto = {
  code: McpServerConnectionErrorCode
  /** HTTP status the server answered with, when it answered. */
  httpStatus: number | null
  /** What the client reported, shortened. For display next to the localized message. */
  detail: string
}

export type McpServerToolDto = {
  name: string
  description: string | null
}

/** Result of one live connection to the server: does it answer, and with which tools. */
export type McpServerInspectionDto = {
  status: McpServerConnectionStatus
  tools: McpServerToolDto[]
  error: McpServerConnectionErrorDto | null
  checkedAt: TimeType
}

export type McpServerOauthInitiationDto = {
  authorizationUrl: string
}

export const completeMcpServerOauthSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

export type CompleteMcpServerOauthDto = z.infer<typeof completeMcpServerOauthSchema>
