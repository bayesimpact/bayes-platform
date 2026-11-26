import type { ChatToolCall } from "@caseai-connect/chat"
import { saveMemoryResultSchema, TOOL_NAMES } from "@caseai-connect/desk-contracts"

/** The facts the `saveMemory` calls of a reply saved or proposed, from their results. */
export function savedMemoryIdsOf(toolCalls: ChatToolCall[]): string[] {
  return toolCalls.flatMap((toolCall) => {
    if (toolCall.name !== TOOL_NAMES.saveMemory) return []
    const result = saveMemoryResultSchema.safeParse(toolCall.result)
    return result.success ? result.data.memories.map((memory) => memory.id) : []
  })
}
