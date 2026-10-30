/**
 * Context the platform forwards to MCP servers on every tool call, as HTTP
 * headers on the MCP transport. Deterministic plumbing: it never goes through
 * the model, so an MCP server can rely on it (a value the model has to copy
 * from its prompt is neither guaranteed nor trustworthy).
 *
 * Deliberately minimal — these headers reach third-party servers. Only what a
 * server needs to attribute a call to a conversation and to a caller: no user
 * name, no message content, no organization or project identifier.
 */
export type McpConversationContext = {
  agentId: string
  /** Session the call belongs to (conversation or public/embed session). */
  sessionId: string
  /**
   * Identifier the embedding page attached to a public session (for France
   * Travail: the "identifiant DE"). Absent on internal sessions.
   */
  externalVisitorId?: string | null
}

export const MCP_CONTEXT_HEADERS = {
  agentId: "X-Bayes-Agent-Id",
  sessionId: "X-Bayes-Session-Id",
  externalVisitorId: "X-Bayes-External-Visitor-Id",
} as const

/**
 * Builds the headers of an MCP transport: the server's own auth, then any
 * static headers from its configuration (whatever a given server expects on
 * every call, e.g. `X-Api-Version`), then the conversation context. Context
 * wins over static headers so a configuration cannot spoof it.
 */
export function buildMcpRequestHeaders({
  apiKey,
  staticHeaders,
  context,
}: {
  apiKey?: string
  staticHeaders?: Record<string, string>
  context?: McpConversationContext
}): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const [name, value] of Object.entries(staticHeaders ?? {})) {
    const trimmedName = name.trim()
    // A header with an empty name or value would make the transport throw.
    if (trimmedName === "" || value.trim() === "") continue
    headers[trimmedName] = value.trim()
  }

  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  if (context) {
    headers[MCP_CONTEXT_HEADERS.agentId] = context.agentId
    headers[MCP_CONTEXT_HEADERS.sessionId] = context.sessionId
    if (context.externalVisitorId) {
      headers[MCP_CONTEXT_HEADERS.externalVisitorId] = context.externalVisitorId
    }
  }

  return headers
}
