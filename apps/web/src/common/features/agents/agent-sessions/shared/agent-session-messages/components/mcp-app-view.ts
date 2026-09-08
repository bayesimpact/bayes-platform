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

/**
 * Text fallback for an MCP App card that gave up rendering: the `text` parts of the tool
 * result's `content` (the MCP `CallToolResult` shape), joined so nothing is lost when the model
 * wrote no prose because it expected the card to speak for the tool.
 */
export function getMcpAppToolResultText(toolResult: unknown): string {
  if (!toolResult || typeof toolResult !== "object" || !("content" in toolResult)) return ""
  const { content } = toolResult as { content: unknown }
  if (!Array.isArray(content)) return ""
  return content
    .flatMap((part: unknown) =>
      part && typeof part === "object" && "text" in part && typeof part.text === "string"
        ? [part.text.trim()]
        : [],
    )
    .filter((text) => text.length > 0)
    .join("\n")
}

/** Joined text of the tool results whose MCP App card failed to render, empty when none did. */
export function getFailedMcpAppFallbackText(
  toolCalls: AgentSessionToolCallDto[] | undefined,
  failedToolCallIds: string[],
): string {
  return (toolCalls ?? [])
    .filter((toolCall) => failedToolCallIds.includes(toolCall.id))
    .map((toolCall) => getMcpAppToolResultText(toolCall.result))
    .filter((text) => text.length > 0)
    .join("\n\n")
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
