import { TOOL_NAMES } from "@caseai-connect/desk-contracts"
import { describe, expect, it } from "vitest"
import { savedMemoryIdsOf } from "./saved-memory-ids"

describe("savedMemoryIdsOf", () => {
  it("reads the facts each saveMemory call saved, and skips other tools and broken results", () => {
    const firstId = crypto.randomUUID()
    const secondId = crypto.randomUUID()
    const saved = (ids: string[]) => ({
      toolName: TOOL_NAMES.saveMemory,
      result: { memories: ids.map((memoryId) => ({ id: memoryId, content: "Prefers email" })) },
    })

    const memoryIds = savedMemoryIdsOf([
      saved([firstId]),
      { toolName: TOOL_NAMES.lookupKnowledgeBase, result: { memories: [] } },
      { toolName: TOOL_NAMES.saveMemory, result: { memories: "none" } },
      saved([secondId]),
    ])

    expect(memoryIds).toEqual([firstId, secondId])
  })
})
