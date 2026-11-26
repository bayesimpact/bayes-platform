import type { ChatToolResult } from "@caseai-connect/chat"
import { saveMemoryResultSchema, TOOL_NAMES } from "@caseai-connect/desk-contracts"

/** The facts the `saveMemory` calls of a reply saved or proposed, from their results. */
export function savedMemoryIdsOf(toolResults: ChatToolResult[]): string[] {
  return toolResults.flatMap((toolResult) => {
    if (toolResult.toolName !== TOOL_NAMES.saveMemory) return []
    const result = saveMemoryResultSchema.safeParse(toolResult.result)
    return result.success ? result.data.memories.map((memory) => memory.id) : []
  })
}
