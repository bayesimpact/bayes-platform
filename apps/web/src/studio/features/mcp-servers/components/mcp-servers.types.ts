import type { McpServerAuthStatus } from "@caseai-connect/api-contracts"

export type McpServerDisplay = {
  id: string
  name: string
  url: string
  /** Null for built-in servers, which are visible in every project. */
  projectId: string | null
  isBuiltIn: boolean
  authStatus: McpServerAuthStatus
  createdAt: number
  updatedAt: number
}
