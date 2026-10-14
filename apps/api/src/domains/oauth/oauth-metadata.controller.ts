import type { AuthorizationServerMetadata } from "@modelcontextprotocol/server"
import { Controller, Get, Header, Req } from "@nestjs/common"
import type { Request } from "express"
import { PRIVATE_API_PATH } from "@/config/api-prefix"
import { getOAuthAuthorizationEndpoint, getOAuthIssuer } from "@/config/public-urls"

/**
 * RFC 8414 metadata of the authorization server. The issuer has a path
 * (`/api/oauth`), so the document sits at the well-known path followed by it.
 */
@Controller()
export class OAuthMetadataController {
  @Get(`.well-known/oauth-authorization-server${PRIVATE_API_PATH}/oauth`)
  @Header("Cache-Control", "public, max-age=3600")
  getMetadata(@Req() request: Request): AuthorizationServerMetadata {
    const issuer = getOAuthIssuer(request)
    return {
      issuer,
      authorization_endpoint: getOAuthAuthorizationEndpoint(request),
      token_endpoint: `${issuer}/token`,
      registration_endpoint: `${issuer}/register`,
      revocation_endpoint: `${issuer}/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
    }
  }
}
