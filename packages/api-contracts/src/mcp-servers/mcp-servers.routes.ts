import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type { CreateMcpServerDto, McpServerDto } from "./mcp-servers.dto"

export const McpServersRoutes = {
  createOne: defineRoute<ResponseData<McpServerDto>, RequestPayload<CreateMcpServerDto>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/mcp-servers",
  }),
  getAll: defineRoute<ResponseData<McpServerDto[]>>({
    method: "get",
    path: "organizations/:organizationId/projects/:projectId/mcp-servers",
  }),
  deleteOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId",
  }),
  enableForAgent: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId/agents/:agentId",
  }),
  disableForAgent: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId/agents/:agentId",
  }),
}
