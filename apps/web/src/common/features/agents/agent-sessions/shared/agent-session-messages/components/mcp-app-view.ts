import type { AgentSessionToolCallDto } from "@caseai-connect/api-contracts"

export type McpAppViewModel = {
  html: string
  toolInput: Record<string, unknown>
  toolResult: unknown
}

export function getRenderableMcpApp(
  toolCall: AgentSessionToolCallDto,
): McpAppViewModel | undefined {
  const html = toolCall.mcpApp?.html
  if (typeof html !== "string" || html.trim().length === 0) return undefined
  if (toolCall.result === undefined) return undefined

  return {
    html,
    toolInput: toolCall.arguments,
    toolResult: toolCall.result,
  }
}

/** The MCP App iframe already shows the tool result, so the markdown recap is redundant. */
export function hasRenderableMcpApp(toolCalls: AgentSessionToolCallDto[] | undefined): boolean {
  return (toolCalls ?? []).some((toolCall) => getRenderableMcpApp(toolCall) !== undefined)
}

/** Only `http:`/`https:` links are safe to open in a new tab from an MCP App. */
export function isOpenableLink(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}
