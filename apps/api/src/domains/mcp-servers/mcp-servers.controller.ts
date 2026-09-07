import {
  createMcpServerSchema,
  type McpServerDto,
  McpServersRoutes,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common"
import type {
  EndpointRequestWithMcpServer,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { isBuiltInMcpServer } from "./built-in/built-in-mcp-servers"
import type { McpServer } from "./mcp-server.entity"
import { McpServerGuard } from "./mcp-server.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpServersService } from "./mcp-servers.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, McpServerGuard)
@RequireContext("organization", "project")
@Controller()
export class McpServersController {
  constructor(private readonly mcpServersService: McpServersService) {}

  @Post(McpServersRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @UsePipes(new ZodValidationPipe(createMcpServerSchema))
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof McpServersRoutes.createOne.request,
  ): Promise<typeof McpServersRoutes.createOne.response> {
    const mcpServer = await this.mcpServersService.createMcpServer({
      projectId: request.project.id,
      name: payload.name,
      config: { url: payload.url, apiKey: payload.apiKey },
    })
    return { data: toMcpServerDto(mcpServer, payload.url) }
  }

  @Get(McpServersRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof McpServersRoutes.getAll.response> {
    const mcpServers = await this.mcpServersService.listMcpServers(request.project.id)
    return {
      data: mcpServers.map((server) =>
        toMcpServerDto(server, this.mcpServersService.decryptUrl(server)),
      ),
    }
  }

  @Delete(McpServersRoutes.deleteOne.path)
  @CheckPolicy((policy) => policy.canDelete())
  @AddContext("mcpServer")
  async deleteOne(
    @Req() request: EndpointRequestWithMcpServer,
  ): Promise<typeof McpServersRoutes.deleteOne.response> {
    await this.mcpServersService.deleteMcpServer(request.mcpServer.id)
    return { data: { success: true } }
  }

  @Post(McpServersRoutes.enableForAgent.path)
  @CheckPolicy((policy) => policy.canCreate())
  @AddContext("mcpServer")
  async enableForAgent(
    @Req() request: EndpointRequestWithMcpServer,
    @Param("agentId") agentId: string,
  ): Promise<typeof McpServersRoutes.enableForAgent.response> {
    await this.mcpServersService.enableForAgent(agentId, request.mcpServer.id)
    return { data: { success: true } }
  }

  @Delete(McpServersRoutes.disableForAgent.path)
  // Not canDelete(): turning a server off for an agent updates the agent's
  // configuration, and built-in servers can be toggled but never deleted.
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("mcpServer")
  async disableForAgent(
    @Req() request: EndpointRequestWithMcpServer,
    @Param("agentId") agentId: string,
  ): Promise<typeof McpServersRoutes.disableForAgent.response> {
    await this.mcpServersService.disableForAgent(agentId, request.mcpServer.id)
    return { data: { success: true } }
  }
}

function toMcpServerDto(entity: McpServer, url: string): McpServerDto {
  // A built-in server's url goes out to every project on purpose: the endpoint
  // is IAM-protected, so knowing it grants nothing, and the UI hides it anyway.
  return {
    id: entity.id,
    name: entity.name,
    url,
    projectId: entity.projectId,
    isBuiltIn: isBuiltInMcpServer(entity),
    createdAt: entity.createdAt.getTime(),
    updatedAt: entity.updatedAt.getTime(),
  }
}
