import type { Request } from "express"
import { PRIVATE_API_PATH } from "./api-prefix"
import { getAppPublicUrl } from "./app-public-url"

/**
 * Public URLs the API announces in OAuth and MCP documents.
 *
 * They must not change with the host a request came to: the web front calls
 * `/api` on its own host, while MCP clients use the API host, and both take
 * part in the same authorization (consent on one, token on the other). So
 * `API_PUBLIC_URL` (the Helm chart sets it from `urls.api`) is the reference.
 * Without it, as in local and worktree environments where one host serves
 * everything, the request's own origin is used; `trust proxy` makes its
 * protocol the one the client saw.
 */
export function getApiPublicOrigin(request: Request, env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.API_PUBLIC_URL?.trim().replace(/\/+$/, "")
  return configured || `${request.protocol}://${request.get("host")}`
}

/** The MCP endpoint, also its OAuth resource identifier (RFC 8707). */
export function getMcpResourceUrl(request: Request): string {
  return `${getApiPublicOrigin(request)}${PRIVATE_API_PATH}/mcp`
}

/** The apps API, the OAuth resource of the tokens issued to apps (ADR 0029). */
export function getAppsResourceUrl(request: Request): string {
  return `${getApiPublicOrigin(request)}${PRIVATE_API_PATH}/apps/v1`
}

/** Issuer of the API's authorization server (ADR 0028). */
export function getOAuthIssuer(request: Request): string {
  return `${getApiPublicOrigin(request)}${PRIVATE_API_PATH}/oauth`
}

/** The issuer and the two resources the authorization server issues tokens for. */
export function getOAuthServerUrls(request: Request): {
  issuer: string
  resource: string
  appsResource: string
} {
  return {
    issuer: getOAuthIssuer(request),
    resource: getMcpResourceUrl(request),
    appsResource: getAppsResourceUrl(request),
  }
}

/** The consent page of the web app is the authorization endpoint. */
export function getOAuthAuthorizationEndpoint(request: Request): string {
  return `${getAppPublicUrl() ?? getApiPublicOrigin(request)}/oauth/authorize`
}
