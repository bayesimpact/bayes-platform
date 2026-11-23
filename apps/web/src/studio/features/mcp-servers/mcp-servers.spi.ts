import type { CreateMcpServerDto, UpdateMcpServerDto } from "@caseai-connect/api-contracts"
import type { McpServer, McpServerInspection } from "./mcp-servers.models"

type ProjectScope = { organizationId: string; projectId: string }
type McpServerScope = ProjectScope & { mcpServerId: string }
type McpServerAgentScope = McpServerScope & { agentId: string }

export type CreateMcpServerFields = CreateMcpServerDto
/** An absent field keeps its stored value. See `updateMcpServerSchema` for the write-only secrets. */
export type UpdateMcpServerFields = UpdateMcpServerDto

export interface IMcpServersSpi {
  getAll: (params: ProjectScope) => Promise<McpServer[]>
  createOne: (params: ProjectScope, payload: CreateMcpServerFields) => Promise<McpServer>
  updateOne: (params: McpServerScope, payload: UpdateMcpServerFields) => Promise<McpServer>
  deleteOne: (params: McpServerScope) => Promise<void>
  /** Connects to the server now: its status, and its tools when it answers. */
  inspect: (params: McpServerScope) => Promise<McpServerInspection>
  enableForAgent: (params: McpServerAgentScope) => Promise<void>
  disableForAgent: (params: McpServerAgentScope) => Promise<void>
  initiateOauth: (params: McpServerScope) => Promise<{ authorizationUrl: string }>
  completeOauth: (
    params: McpServerScope,
    payload: { code: string; state: string },
  ) => Promise<McpServer>
}
