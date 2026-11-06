import type { McpAppCspDto } from "@caseai-connect/api-contracts"

export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app"

const CSP_DOMAIN_KEYS = [
  "connectDomains",
  "resourceDomains",
  "frameDomains",
  "baseUriDomains",
] as const satisfies ReadonlyArray<keyof McpAppCspDto>
const MAX_CSP_DOMAINS_PER_KEY = 32
const MAX_CSP_DOMAIN_LENGTH = 253

export type McpResourceReadResult = {
  contents?: Array<{
    uri?: string
    mimeType?: string
    text?: string
    blob?: string
    _meta?: unknown
  }>
}

/** An MCP App card as read from its server: its HTML and the domains it declares. */
export type McpAppResource = {
  html: string
  csp?: McpAppCspDto
}

export class McpAppResourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "McpAppResourceError"
  }
}

function isMcpAppMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return false
  const normalized = mimeType.toLowerCase().replaceAll(/\s+/g, "")
  return normalized === MCP_APP_MIME_TYPE || normalized.startsWith(`${MCP_APP_MIME_TYPE};`)
}

function decodeHtml(content: { text?: string; blob?: string }): string | undefined {
  if (typeof content.text === "string") return content.text
  if (typeof content.blob === "string") {
    return Buffer.from(content.blob, "base64").toString("utf8")
  }
  return undefined
}

/**
 * The domains of `_meta.ui.csp`, keeping only lists of strings. The client checks each domain
 * again before it writes the policy, so this only drops what is not even the right shape.
 */
export function readMcpAppCsp(meta: unknown): McpAppCspDto | undefined {
  if (!meta || typeof meta !== "object" || !("ui" in meta)) return undefined
  const ui = meta.ui
  if (!ui || typeof ui !== "object" || !("csp" in ui)) return undefined
  const csp = ui.csp
  if (!csp || typeof csp !== "object") return undefined

  const declared: McpAppCspDto = {}
  for (const key of CSP_DOMAIN_KEYS) {
    const domains: unknown = (csp as Record<string, unknown>)[key]
    if (!Array.isArray(domains)) continue
    declared[key] = domains
      .filter(
        (domain): domain is string =>
          typeof domain === "string" && domain.length > 0 && domain.length <= MAX_CSP_DOMAIN_LENGTH,
      )
      .slice(0, MAX_CSP_DOMAINS_PER_KEY)
  }
  return Object.keys(declared).length > 0 ? declared : undefined
}

/**
 * Validates a `resources/read` result and returns the MCP App HTML with the domains it declares.
 * Only `ui://` URIs with `text/html;profile=mcp-app` are accepted.
 */
export function readMcpAppResource({
  resourceUri,
  resource,
}: {
  resourceUri: string
  resource: McpResourceReadResult
}): McpAppResource {
  if (!resourceUri.startsWith("ui://")) {
    throw new McpAppResourceError(`Unsupported MCP App resource URI: ${resourceUri}`)
  }

  const contents = resource.contents ?? []
  const content =
    contents.find((entry) => entry.uri === resourceUri) ??
    (contents.length === 1 ? contents[0] : undefined)

  if (!content) {
    throw new McpAppResourceError(`MCP App resource not found: ${resourceUri}`)
  }

  if (!isMcpAppMimeType(content.mimeType)) {
    throw new McpAppResourceError(
      `Unsupported MCP App resource MIME type: ${content.mimeType ?? "missing"}`,
    )
  }

  const html = decodeHtml(content)
  if (html == null || html.trim().length === 0) {
    throw new McpAppResourceError(`Malformed MCP App resource: ${resourceUri}`)
  }

  const csp = readMcpAppCsp(content._meta)
  return csp ? { html, csp } : { html }
}
