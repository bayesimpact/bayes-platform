import type { McpServerAuthMethod, McpServerAuthStatus } from "@caseai-connect/api-contracts"

export type McpServerDisplay = {
  id: string
  name: string
  url: string
  /** Null for built-in servers, which are visible in every project. */
  projectId: string | null
  isBuiltIn: boolean
  authMethod: McpServerAuthMethod
  authStatus: McpServerAuthStatus
  /** Names of the static headers. Their values stay on the server. */
  headerNames: string[]
  createdAt: number
  updatedAt: number
}
