import { describe, expect, it } from "vitest"
import { decisionsFromAnswers, parseSaveMemoryResult } from "./agent-memories.helpers"

describe("parseSaveMemoryResult", () => {
  it("returns the facts of a saveMemory tool result", () => {
    expect(
      parseSaveMemoryResult({
        memories: [
          { id: "m-1", content: "Prefers short answers", status: "saved" },
          { id: "m-2", content: "Works on weekends", status: "pending" },
        ],
      }),
    ).toEqual([
      { id: "m-1", content: "Prefers short answers", status: "saved" },
      { id: "m-2", content: "Works on weekends", status: "pending" },
    ])
  })

  it("ignores malformed results and items", () => {
    expect(parseSaveMemoryResult(undefined)).toEqual([])
    expect(parseSaveMemoryResult({ memories: "nope" })).toEqual([])
    expect(
      parseSaveMemoryResult({ memories: [{ id: "m-1" }, null, { id: 2, content: "x" }] }),
    ).toEqual([])
  })
})

describe("decisionsFromAnswers", () => {
  const proposals = [
    { id: "m-1", content: "Likes bullet points", status: "pending" as const },
    { id: "m-2", content: "Works on weekends", status: "pending" as const },
    { id: "m-3", content: "Has a cat", status: "pending" as const },
    { id: "m-4", content: "Lives in Lyon", status: "pending" as const },
  ]

  it("maps save, reject, rewording and skipped answers", () => {
    const answers: Record<string, string[]> = {
      "m-1": ["save"],
      "m-2": ["Works on Saturdays"],
      "m-3": ["reject"],
    }

    expect(decisionsFromAnswers(proposals, (memoryId) => answers[memoryId] ?? [])).toEqual([
      { memoryId: "m-1", decision: "save" },
      { memoryId: "m-2", decision: "save", content: "Works on Saturdays" },
      { memoryId: "m-3", decision: "reject" },
    ])
  })

  it("treats an unchanged or blank text as a plain save", () => {
    const answers: Record<string, string[]> = {
      "m-1": ["save", "Likes bullet points"],
      "m-2": ["save", "   "],
    }

    expect(decisionsFromAnswers(proposals, (memoryId) => answers[memoryId] ?? [])).toEqual([
      { memoryId: "m-1", decision: "save" },
      { memoryId: "m-2", decision: "save" },
    ])
  })
})
