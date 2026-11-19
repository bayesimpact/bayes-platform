import {
  type CallToolResult,
  CallToolResultSchema,
  type ContentBlock,
} from "@modelcontextprotocol/sdk/types.js"
import { isRecord } from "./is-record"

/**
 * The raw MCP result a host kept for a tool that shows an app, read with the SDK's schema, or
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

/**
 * Whether a tool call failed, as MCP says it: its result carries `isError`. A host shows no app
 * for it: the app has no data to show, and the model reads the error and often calls the tool
 * again, which then shows its app once.
 */
export function isToolError(result: unknown): boolean {
  return isRecord(result) && result.isError === true
}

/** The text of a tool result, which a host shows instead of an app that could not render. */
export function toolResultText(result: unknown): string {
  return textsOf(parseCallToolResult(result)?.content ?? []).join("\n")
}

/** The text an app asks to put in the message box: its text blocks, one paragraph each. */
export function appMessageText(content: ContentBlock[]): string {
  return textsOf(content).join("\n\n")
}
