import { describe, expect, it } from "vitest"
import { buildConversationRunRecord } from "@/test/factories/conversation-runs.factory"
import { filterResults } from "./result-filters"

describe("filterResults", () => {
  const records = [
    buildConversationRunRecord({ score: 5 }),
    buildConversationRunRecord({ score: 2 }),
    buildConversationRunRecord({ score: 0 }),
    buildConversationRunRecord({ status: "error", score: null, output: null }),
    buildConversationRunRecord({ status: "running", score: null, output: null }),
    buildConversationRunRecord({ status: "cancelled", score: null, output: null }),
  ]

  it("keeps everything, or the records of one kind", () => {
    expect(filterResults(records, "all")).toHaveLength(6)
    expect(filterResults(records, "errors")).toHaveLength(1)
    expect(filterResults(records, "waiting")).toHaveLength(1)
    expect(filterResults(records, "notAsked")).toHaveLength(1)
  })

  it("counts a score of 2 or less as low, and a record with no score as none", () => {
    expect(filterResults(records, "lowScores").map((record) => record.score)).toEqual([2, 0])
  })
})
