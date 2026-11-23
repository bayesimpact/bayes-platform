import { describe, expect, it } from "vitest"
import { buildExtractionRunRecord } from "@/test/factories/extraction-runs.factory"
import { comparisonRowsOf } from "./comparison"

describe("comparisonRowsOf", () => {
  it("gives one row per record of the dataset, named by what the agent read", () => {
    const datasetRecordId = crypto.randomUUID()
    const data = { message: "A sample message.", author: "Sample author", note: "" }
    const rows = comparisonRowsOf(
      [
        {
          runId: "first-run",
          records: [
            buildExtractionRunRecord({
              evaluationExtractionDatasetRecordId: datasetRecordId,
              status: "match",
              datasetRecordData: data,
            }),
          ],
        },
        {
          runId: "second-run",
          records: [
            buildExtractionRunRecord({
              evaluationExtractionDatasetRecordId: datasetRecordId,
              status: "mismatch",
              datasetRecordData: data,
            }),
          ],
        },
      ],
      ["message", "author", "note"],
    )

    expect(rows).toHaveLength(1)
    // An empty value names nothing.
    expect(rows[0]?.label).toBe("A sample message. · Sample author")
    expect(rows[0]?.byRunId["first-run"]?.status).toBe("match")
    expect(rows[0]?.byRunId["second-run"]?.status).toBe("mismatch")
  })

  it("keeps a record only one run asked, with nothing for the other run", () => {
    const rows = comparisonRowsOf(
      [
        { runId: "first-run", records: [buildExtractionRunRecord()] },
        { runId: "second-run", records: [] },
      ],
      [],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.byRunId["second-run"]).toBeUndefined()
  })
})
