import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Logger,
  UnauthorizedException,
} from "@nestjs/common"
import type { Request, Response } from "express"
import { getProtectedResourceMetadataUrl } from "./mcp-endpoint.urls"

/**
 * Adds the `WWW-Authenticate` challenge MCP clients need to start the OAuth
 * flow (MCP authorization spec, RFC 9728 section 5.1): it names the protected
 * resource metadata document, which names the authorization server.
 */
@Catch(UnauthorizedException)
export class McpUnauthorizedFilter implements ExceptionFilter {
  private readonly logger = new Logger(McpUnauthorizedFilter.name)

  catch(exception: UnauthorizedException, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<Request>()
    const response = host.switchToHttp().getResponse<Response>()
    this.logger.warn(`${exception.message} (${request.method} ${request.url})`)

    const hasToken = Boolean(request.headers.authorization)
    const challenge = [
      `resource_metadata="${getProtectedResourceMetadataUrl(request)}"`,
      ...(hasToken ? ['error="invalid_token"'] : []),
    ].join(", ")
    response
      .status(401)
      .setHeader("WWW-Authenticate", `Bearer ${challenge}`)
      .json(exception.getResponse())
  }
}
