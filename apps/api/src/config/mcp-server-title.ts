const DEFAULT_MCP_SERVER_TITLE = "Agent platform"

/**
 * Name of the platform MCP server shown to MCP clients and on the OAuth
 * protected resource metadata. Each deployment sets its own with
 * `MCP_SERVER_TITLE`.
 */
export function getMcpServerTitle(env: NodeJS.ProcessEnv = process.env): string {
  return env.MCP_SERVER_TITLE?.trim() || DEFAULT_MCP_SERVER_TITLE
}
