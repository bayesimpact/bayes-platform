import type { McpAppHtmlOutputDto } from "@caseai-connect/desk-contracts"
import {
  type CallToolResult,
  CallToolResultSchema,
  type ContentBlock,
} from "@modelcontextprotocol/sdk/types.js"
import { isRecord } from "@/lib/is-record"
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

/**
 * The raw MCP result the API kept for a tool that shows an app, read with the SDK's schema, or
 * `null` when the result has no `content` or breaks the schema.
 */
function parseCallToolResult(result: unknown): CallToolResult | null {
  // The schema gives a missing `content` an empty list: only a result that has one is raw.
  if (!isRecord(result) || !("content" in result)) return null
  const parsed = CallToolResultSchema.safeParse(result)
  return parsed.success ? parsed.data : null
}

/** The text blocks of an MCP content list, trimmed, without the empty ones. */
function textsOf(blocks: ContentBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.type === "text" && block.text.trim() !== "" ? [block.text.trim()] : [],
  )
}

/**
 * A tool result as an MCP App reads it: a raw MCP result as it is, anything else as the
 * structured content of an empty text result.
 */
export function toCallToolResult(result: unknown): CallToolResult {
  return (
    parseCallToolResult(result) ?? {
      content: [{ type: "text", text: "" }],
      structuredContent: isRecord(result) ? result : { value: result },
    }
  )
}

/** The text of a tool result, shown instead of an app that could not render. */
export function toolResultText(result: unknown): string {
  return textsOf(parseCallToolResult(result)?.content ?? []).join("\n")
}

/** The text an app asks to put in the message box: its text blocks, one paragraph each. */
export function appMessageText(content: ContentBlock[]): string {
  return textsOf(content).join("\n\n")
}

/**
 * The message box once an app put its text in it: after what the person already wrote, as a
 * paragraph of its own, so an app never erases their words.
 */
export function withAppMessage(draft: string, text: string): string {
  return draft.trim() === "" ? text : `${draft.trimEnd()}\n\n${text}`
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
