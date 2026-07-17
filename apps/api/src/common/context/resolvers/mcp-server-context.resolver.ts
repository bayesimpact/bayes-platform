import { Injectable, NotFoundException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpServersService } from "@/domains/mcp-servers/mcp-servers.service"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithMcpServer } from "../request.interface"

@Injectable()
export class McpServerContextResolver implements ContextResolver {
  readonly resource = "mcpServer" as const

  constructor(private readonly mcpServersService: McpServersService) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { mcpServerId?: string }
    }
    const mcpServerId = requestWithParams.params?.mcpServerId

    if (!mcpServerId || mcpServerId === ":mcpServerId") {
      throw new NotFoundException()
    }

    const requestWithMcpServer = request as unknown as EndpointRequestWithMcpServer
    const mcpServer = await this.mcpServersService.findMcpServerById(
      mcpServerId,
      requestWithMcpServer.project.id,
    )
    if (!mcpServer) throw new NotFoundException()

    requestWithMcpServer.mcpServer = mcpServer
  }
}
