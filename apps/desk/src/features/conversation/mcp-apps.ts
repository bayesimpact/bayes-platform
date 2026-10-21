import type { McpAppHtmlOutputDto } from "@caseai-connect/desk-contracts"
import type { ChatMcpApp } from "./chat-messages"

/**
 * The HTML of an app: the first one of its resource, from its server, or from any server for a
 * pointer saved before servers were named. `null` when the API sent none.
 */
export function findMcpAppHtml(app: ChatMcpApp, htmls: McpAppHtmlOutputDto[]): string | null {
  const match = htmls.find(
    (entry) =>
      entry.resourceUri === app.resourceUri &&
      (app.mcpServerId === null || entry.mcpServerId === app.mcpServerId) &&
      entry.html.trim() !== "",
  )
  return match?.html ?? null
}

type ContentBlock = { type?: unknown; text?: unknown }

function contentBlocksOf(value: unknown): ContentBlock[] {
  if (typeof value !== "object" || value === null || !("content" in value)) return []
  const { content } = value
  return Array.isArray(content) ? content : []
}

/** The text blocks of an MCP content list, trimmed, without the empty ones. */
function textsOf(blocks: ContentBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.type === "text" && typeof block.text === "string" && block.text.trim() !== ""
      ? [block.text.trim()]
      : [],
  )
}

/**
 * A tool result as an MCP App reads it: a result with `content` as it is, anything else as the
 * structured content of an empty text result.
 */
export function toCallToolResult(result: unknown): {
  content: { type: "text"; text: string }[]
  structuredContent?: Record<string, unknown>
} {
  if (typeof result === "object" && result !== null && "content" in result) {
    // Safe: a result with `content` is the raw MCP result the API kept for the app.
    return result as { content: { type: "text"; text: string }[] }
  }
  const structuredContent =
    typeof result === "object" && result !== null && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : { value: result }
  return { content: [{ type: "text", text: "" }], structuredContent }
}

/** The text of a tool result, shown instead of an app that could not render. */
export function toolResultText(result: unknown): string {
  return textsOf(contentBlocksOf(result)).join("\n")
}

/** The text an app asks to put in the message box: its text blocks, one paragraph each. */
export function appMessageText(content: unknown): string {
  return textsOf(Array.isArray(content) ? content : []).join("\n\n")
}

/** Whether a reply's text says something: a lone "." beside a card says nothing. */
export function hasMeaningfulText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text)
}

/** The HTML of a conversation's apps, and whether it is still on its way. */
export type AppsHtml = {
  htmls: McpAppHtmlOutputDto[]
  isPending: boolean
}

/** The apps of a reply that show no card: they failed, or the API sent no HTML for them. */
export function unavailableApps(
  apps: ChatMcpApp[],
  appsHtml: AppsHtml,
  failedAppIds: string[],
): ChatMcpApp[] {
  return apps.filter(
    (app) =>
      failedAppIds.includes(app.toolCallId) ||
      (!appsHtml.isPending && findMcpAppHtml(app, appsHtml.htmls) === null),
  )
}
