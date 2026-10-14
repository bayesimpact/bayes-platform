import type { Request } from "express"
import { PRIVATE_API_PATH } from "@/config/api-prefix"
import { getApiPublicOrigin } from "@/config/public-urls"

/** Path of the MCP endpoint under the private API prefix. */
export const MCP_ENDPOINT_PATH = "mcp"

/** RFC 9728 well-known prefix. The resource path is appended to it. */
export const PROTECTED_RESOURCE_METADATA_PATH = ".well-known/oauth-protected-resource"

/** `https://host/api/mcp` → `https://host/.well-known/oauth-protected-resource/api/mcp` */
export function getProtectedResourceMetadataUrl(request: Request): string {
  return `${getApiPublicOrigin(request)}/${PROTECTED_RESOURCE_METADATA_PATH}${PRIVATE_API_PATH}/${MCP_ENDPOINT_PATH}`
}
