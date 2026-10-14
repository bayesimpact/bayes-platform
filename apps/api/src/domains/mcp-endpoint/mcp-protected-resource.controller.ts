import { OAUTH_GRANTABLE_PERMISSIONS } from "@caseai-connect/api-contracts"
import type { OAuthProtectedResourceMetadata } from "@modelcontextprotocol/server"
import { Controller, Get, Header, Req } from "@nestjs/common"
import type { Request } from "express"
import { PRIVATE_API_PATH } from "@/config/api-prefix"
import { getMcpResourceUrl, getOAuthIssuer } from "@/config/public-urls"
import { MCP_SERVER_NAME } from "./agent-creation-mcp-server"
import { MCP_ENDPOINT_PATH, PROTECTED_RESOURCE_METADATA_PATH } from "./mcp-endpoint.urls"

/**
 * RFC 9728 protected resource metadata of the MCP endpoint, served outside
 * the `api` prefix at the path the RFC derives from the resource URL. The
 * authorization server is the API's own (ADR 0028).
 */
@Controller()
export class McpProtectedResourceController {
  @Get(`${PROTECTED_RESOURCE_METADATA_PATH}${PRIVATE_API_PATH}/${MCP_ENDPOINT_PATH}`)
  @Header("Access-Control-Allow-Origin", "*")
  getMetadata(@Req() request: Request): OAuthProtectedResourceMetadata {
    return {
      resource: getMcpResourceUrl(request),
      authorization_servers: [getOAuthIssuer(request)],
      scopes_supported: [...OAUTH_GRANTABLE_PERMISSIONS],
      bearer_methods_supported: ["header"],
      resource_name: MCP_SERVER_NAME,
    }
  }
}
