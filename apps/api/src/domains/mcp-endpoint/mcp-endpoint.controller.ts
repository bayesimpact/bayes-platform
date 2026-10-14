import { toNodeHandler } from "@modelcontextprotocol/node"
import {
  type AuthInfo,
  createMcpHandler,
  type McpRequestContext,
} from "@modelcontextprotocol/server"
import {
  All,
  Controller,
  Logger,
  type OnModuleDestroy,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common"
import type { Response } from "express"
import { getMcpResourceUrl } from "@/config/public-urls"
import {
  OAuthAccessTokenGuard,
  type OAuthAuthenticatedRequest,
} from "@/domains/oauth/oauth-access-token.guard"
import { buildAgentCreationMcpServer } from "./agent-creation-mcp-server"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpAgentToolsService, type McpCaller } from "./mcp-agent-tools.service"
import { MCP_ENDPOINT_PATH } from "./mcp-endpoint.urls"
import { McpUnauthorizedFilter } from "./mcp-unauthorized.filter"

type McpCallerAuthInfo = AuthInfo & { extra: { caller: McpCaller } }

/**
 * Streamable HTTP MCP endpoint (protocol 2026-07-28, with the stateless
 * fallback for 2025 clients). It takes the access tokens of the API's
 * authorization server (ADR 0028); an unauthenticated call gets a `401` whose
 * `WWW-Authenticate` header points to the protected resource metadata, from
 * which MCP clients find that server.
 */
@UseGuards(OAuthAccessTokenGuard)
@UseFilters(McpUnauthorizedFilter)
@Controller()
export class McpEndpointController implements OnModuleDestroy {
  private readonly logger = new Logger(McpEndpointController.name)
  private readonly mcpHandler
  private readonly nodeHandler

  constructor(private readonly toolsService: McpAgentToolsService) {
    const onerror = (error: Error) => this.logger.warn(`MCP request failed: ${error.message}`)
    this.mcpHandler = createMcpHandler((context) => this.buildServer(context), { onerror })
    this.nodeHandler = toNodeHandler(this.mcpHandler, { onerror })
  }

  @All(MCP_ENDPOINT_PATH)
  async handle(@Req() request: OAuthAuthenticatedRequest, @Res() response: Response) {
    const { oauthGrant: grant } = request
    const auth: McpCallerAuthInfo = {
      token: request.headers.authorization?.replace(/^Bearer /i, "") ?? "",
      clientId: grant.client.clientId,
      scopes: grant.permissions,
      resource: new URL(getMcpResourceUrl(request)),
      extra: {
        caller: {
          userId: request.user.id,
          projectIds: grant.projects.map((project) => project.id),
          permissions: grant.permissions,
        },
      },
    }
    await this.nodeHandler(Object.assign(request, { auth }), response, request.body)
  }

  async onModuleDestroy() {
    await this.mcpHandler.close()
  }

  private buildServer({ authInfo }: McpRequestContext) {
    const caller = (authInfo as McpCallerAuthInfo | undefined)?.extra.caller
    if (!caller) {
      // The guard runs before the handler, so this only happens on a wiring mistake.
      throw new Error("MCP request reached the server without a grant")
    }
    return buildAgentCreationMcpServer({ caller, toolsService: this.toolsService })
  }
}
