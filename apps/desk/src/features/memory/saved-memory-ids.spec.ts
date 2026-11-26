import { TOOL_NAMES } from "@caseai-connect/desk-contracts"
import { describe, expect, it } from "vitest"
import { savedMemoryIdsOf } from "./saved-memory-ids"

describe("savedMemoryIdsOf", () => {
  it("reads the facts each saveMemory call saved, and skips other tools and broken results", () => {
    const firstId = crypto.randomUUID()
    const secondId = crypto.randomUUID()
    const saved = (id: string, ids: string[]) => ({
      id,
      name: TOOL_NAMES.saveMemory,
      result: { memories: ids.map((memoryId) => ({ id: memoryId, content: "Prefers email" })) },
    })

    const memoryIds = savedMemoryIdsOf([
      saved("first", [firstId]),
      { id: "lookup", name: TOOL_NAMES.lookupKnowledgeBase, result: { memories: [] } },
      { id: "broken", name: TOOL_NAMES.saveMemory, result: { memories: "none" } },
      saved("second", [secondId]),
    ])

    expect(memoryIds).toEqual([firstId, secondId])
  })
})
