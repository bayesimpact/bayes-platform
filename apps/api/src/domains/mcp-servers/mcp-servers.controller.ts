import {
  completeMcpServerOauthSchema,
  createMcpServerSchema,
  type McpServerAuthStatus,
  type McpServerDto,
  McpServersRoutes,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Delete, Get, Post, Req, UseGuards, UsePipes } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithMcpServer,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  PROJECT_MCP_SERVER_CREATE_PERMISSION,
  PROJECT_MCP_SERVER_DELETE_PERMISSION,
  PROJECT_MCP_SERVER_READ_PERMISSION,
  PROJECT_MCP_SERVER_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { isBuiltInMcpServer } from "./built-in/built-in-mcp-servers"
import type { McpServer } from "./mcp-server.entity"
import type { McpServerConfig } from "./mcp-servers.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpServersService } from "./mcp-servers.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpOauthService } from "./oauth/mcp-oauth.service"

type EndpointRequestWithAgentAndMcpServer = EndpointRequestWithAgent & EndpointRequestWithMcpServer

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class McpServersController {
  constructor(
    private readonly mcpServersService: McpServersService,
    private readonly mcpOauthService: McpOauthService,
  ) {}

  @Post(McpServersRoutes.createOne.path)
  @CheckPermission(PROJECT_MCP_SERVER_CREATE_PERMISSION, "project")
  @UsePipes(new ZodValidationPipe(createMcpServerSchema))
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof McpServersRoutes.createOne.request,
  ): Promise<typeof McpServersRoutes.createOne.response> {
    // Infer the method for legacy callers that omit it: a key means apiKey, else none.
    const authMethod = payload.authMethod ?? (payload.apiKey ? "apiKey" : "none")
    const config = {
      url: payload.url,
      authMethod,
      apiKey: authMethod === "apiKey" ? payload.apiKey : undefined,
      headers: payload.headers,
    }
    const mcpServer = await this.mcpServersService.createMcpServer({
      projectId: request.project.id,
      name: payload.name,
      config,
    })
    return {
      data: toMcpServerDto(mcpServer, config, this.mcpServersService.getAuthStatus(config)),
    }
  }

  @Get(McpServersRoutes.getAll.path)
  @CheckPermission(PROJECT_MCP_SERVER_READ_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof McpServersRoutes.getAll.response> {
    const mcpServers = await this.mcpServersService.listMcpServers(request.project.id)
    return {
      data: mcpServers.map((server) => {
        const config = this.mcpServersService.getConfig(server)
        return toMcpServerDto(server, config, this.mcpServersService.getAuthStatus(config))
      }),
    }
  }

  @Delete(McpServersRoutes.deleteOne.path)
  // Built-in servers can be toggled but never deleted: the service refuses them.
  @CheckPermission(PROJECT_MCP_SERVER_DELETE_PERMISSION, "project")
  @AddContext("mcpServer")
  async deleteOne(
    @Req() request: EndpointRequestWithMcpServer,
  ): Promise<typeof McpServersRoutes.deleteOne.response> {
    await this.mcpServersService.deleteMcpServer(request.mcpServer.id)
    return { data: { success: true } }
  }

  // The agent is resolved from the request project: a built-in server is
  // visible from every project, so the agent id alone would let one project
  // toggle it on an agent of another.
  @Post(McpServersRoutes.enableForAgent.path)
  @CheckPermission(PROJECT_MCP_SERVER_UPDATE_PERMISSION, "project")
  @AddContext("mcpServer", "agent")
  async enableForAgent(
    @Req() request: EndpointRequestWithAgentAndMcpServer,
  ): Promise<typeof McpServersRoutes.enableForAgent.response> {
    await this.mcpServersService.enableForAgent(request.agent.id, request.mcpServer.id)
    return { data: { success: true } }
  }

  @Delete(McpServersRoutes.disableForAgent.path)
  // Not .delete: turning a server off for an agent updates the agent's
  // configuration, and built-in servers can be toggled but never deleted.
  @CheckPermission(PROJECT_MCP_SERVER_UPDATE_PERMISSION, "project")
  @AddContext("mcpServer", "agent")
  async disableForAgent(
    @Req() request: EndpointRequestWithAgentAndMcpServer,
  ): Promise<typeof McpServersRoutes.disableForAgent.response> {
    await this.mcpServersService.disableForAgent(request.agent.id, request.mcpServer.id)
    return { data: { success: true } }
  }

  @Post(McpServersRoutes.initiateOauth.path)
  @CheckPermission(PROJECT_MCP_SERVER_UPDATE_PERMISSION, "project")
  @AddContext("mcpServer")
  async initiateOauth(
    @Req() request: EndpointRequestWithMcpServer,
  ): Promise<typeof McpServersRoutes.initiateOauth.response> {
    const { authorizationUrl } = await this.mcpOauthService.initiateAuthorization(request.mcpServer)
    return { data: { authorizationUrl } }
  }

  @Post(McpServersRoutes.completeOauth.path)
  @CheckPermission(PROJECT_MCP_SERVER_UPDATE_PERMISSION, "project")
  @AddContext("mcpServer")
  @UsePipes(new ZodValidationPipe(completeMcpServerOauthSchema))
  async completeOauth(
    @Req() request: EndpointRequestWithMcpServer,
    @Body() { payload }: typeof McpServersRoutes.completeOauth.request,
  ): Promise<typeof McpServersRoutes.completeOauth.response> {
    const updated = await this.mcpOauthService.completeAuthorization({
      mcpServer: request.mcpServer,
      code: payload.code,
      state: payload.state,
    })
    const config = this.mcpServersService.getConfig(updated)
    return { data: toMcpServerDto(updated, config, this.mcpServersService.getAuthStatus(config)) }
  }
}

function toMcpServerDto(
  entity: McpServer,
  config: McpServerConfig,
  authStatus: McpServerAuthStatus,
): McpServerDto {
  // A built-in server's url goes out to every project on purpose: the endpoint
  // is IAM-protected, so knowing it grants nothing, and the UI hides it anyway.
  return {
    id: entity.id,
    name: entity.name,
    url: config.url,
    projectId: entity.projectId,
    isBuiltIn: isBuiltInMcpServer(entity),
    authStatus,
    createdAt: entity.createdAt.getTime(),
    updatedAt: entity.updatedAt.getTime(),
  }
}
