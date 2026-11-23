import { CONVERSATION_DATASET_RECORD_MAX_LENGTH } from "@caseai-connect/eval-contracts"
import { describe, expect, it } from "vitest"
import { parseBulkRecords } from "./bulk-records"

describe("parseBulkRecords", () => {
  it("reads a record per line, split on the first comma, and skips empty lines", () => {
    const parsed = parseBulkRecords("Is there a trial?, Yes, 14 days\n\n  How do I pay? ,By card\n")

    expect(parsed).toEqual({
      records: [
        { input: "Is there a trial?", expectedOutput: "Yes, 14 days" },
        { input: "How do I pay?", expectedOutput: "By card" },
      ],
      invalidLines: [],
      tooLongLines: [],
    })
  })

  it("names the lines with no comma or an empty side, and the ones too long", () => {
    const tooLong = "a".repeat(CONVERSATION_DATASET_RECORD_MAX_LENGTH + 1)
    const parsed = parseBulkRecords(
      `No comma here\n, only an answer\nQuestion,\n${tooLong},ok\nQ,A`,
    )

    expect(parsed.records).toEqual([{ input: "Q", expectedOutput: "A" }])
    expect(parsed.invalidLines).toEqual([1, 2, 3])
    expect(parsed.tooLongLines).toEqual([4])
  })
})
