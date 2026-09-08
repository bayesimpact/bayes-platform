import type { McpServerAuthMethod } from "@caseai-connect/api-contracts"
import type { McpServer } from "./mcp-servers.models"

type ProjectScope = { organizationId: string; projectId: string }
type McpServerScope = ProjectScope & { mcpServerId: string }
type McpServerAgentScope = McpServerScope & { agentId: string }
type CreateMcpServerFields = {
  name: string
  url: string
  authMethod?: McpServerAuthMethod
  apiKey?: string
}

export interface IMcpServersSpi {
  getAll: (params: ProjectScope) => Promise<McpServer[]>
  createOne: (params: ProjectScope, payload: CreateMcpServerFields) => Promise<McpServer>
  deleteOne: (params: McpServerScope) => Promise<void>
  enableForAgent: (params: McpServerAgentScope) => Promise<void>
  disableForAgent: (params: McpServerAgentScope) => Promise<void>
  initiateOauth: (params: McpServerScope) => Promise<{ authorizationUrl: string }>
  completeOauth: (
    params: McpServerScope,
    payload: { code: string; state: string },
  ) => Promise<McpServer>
}
