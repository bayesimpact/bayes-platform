import type {
  AgentSessionMcpAppDto,
  AgentSessionMcpAppHtmlDto,
  AgentSessionToolCallDto,
} from "@caseai-connect/api-contracts"

export type McpAppViewModel = {
  html: string
  toolInput: Record<string, unknown>
  toolResult: unknown
}

/** Whether a reply points at an MCP App card, so the card HTML is worth loading. */
export function hasMcpAppPointer(
  messages: { toolCalls?: AgentSessionToolCallDto[] | null }[],
): boolean {
  return messages.some((message) =>
    (message.toolCalls ?? []).some((toolCall) => typeof toolCall.mcpApp?.resourceUri === "string"),
  )
}

/**
 * A tool call that shows an MCP App card: it points at one and has a result to hand it. Its HTML
 * may still be loading, so this says a card belongs here, not that it can render yet.
 */
export function hasMcpAppCard(toolCall: AgentSessionToolCallDto): boolean {
  return typeof toolCall.mcpApp?.resourceUri === "string" && toolCall.result !== undefined
}

/**
 * Current HTML for a card pointer. The HTML embedded on the tool call wins (stories); otherwise
 * the entry read from the same server, or, for a pointer recorded without a server id, the
 * entry any server returned for that `ui://`.
 */
export function findMcpAppHtml(
  mcpApp: AgentSessionMcpAppDto,
  htmlEntries: AgentSessionMcpAppHtmlDto[],
): string | undefined {
  if (typeof mcpApp.html === "string" && mcpApp.html.trim().length > 0) return mcpApp.html
  const entry = htmlEntries.find(
    (candidate) =>
      candidate.resourceUri === mcpApp.resourceUri &&
      (!mcpApp.mcpServerId || candidate.mcpServerId === mcpApp.mcpServerId),
  )
  return entry && entry.html.trim().length > 0 ? entry.html : undefined
}

export function getRenderableMcpApp(
  toolCall: AgentSessionToolCallDto,
  htmlEntries: AgentSessionMcpAppHtmlDto[] = [],
): McpAppViewModel | undefined {
  if (!toolCall.mcpApp || toolCall.result === undefined) return undefined
  const html = findMcpAppHtml(toolCall.mcpApp, htmlEntries)
  if (html === undefined) return undefined

  return {
    html,
    toolInput: toolCall.arguments,
    toolResult: toolCall.result,
  }
}

/**
 * Text of the reply bubble. What the model wrote always stands, next to its MCP App cards: the
 * card shows the tool result, the text carries what the model said about it. Only when the model
 * wrote nothing does the text of a card that gave up rendering stand in for the reply.
 */
export function getReplyBubbleText(
  content: string,
  toolCalls: AgentSessionToolCallDto[] | undefined,
  unavailableMcpAppToolCallIds: string[],
): string {
  if (content.trim().length > 0) return content
  return getFailedMcpAppFallbackText(toolCalls, unavailableMcpAppToolCallIds)
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
