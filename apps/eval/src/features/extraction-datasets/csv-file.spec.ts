import { EXTRACTION_DATASET_FILE_MAX_SIZE } from "@caseai-connect/eval-contracts"
import { describe, expect, it } from "vitest"
import { csvFileProblemOf } from "./csv-file"

describe("csvFileProblemOf", () => {
  it("accepts a CSV by its type", () => {
    expect(csvFileProblemOf({ name: "rows", type: "text/csv", size: 10 })).toBeNull()
  })

  it("accepts a CSV by its name, when the system types it as a spreadsheet", () => {
    expect(
      csvFileProblemOf({ name: "Rows.CSV", type: "application/vnd.ms-excel", size: 10 }),
    ).toBeNull()
  })

  it("refuses a file that is not a CSV", () => {
    expect(csvFileProblemOf({ name: "rows.pdf", type: "application/pdf", size: 10 })).toBe("notCsv")
  })

  it("refuses a CSV over the limit", () => {
    const size = EXTRACTION_DATASET_FILE_MAX_SIZE + 1
    expect(csvFileProblemOf({ name: "rows.csv", type: "text/csv", size })).toBe("tooLarge")
  })
})
