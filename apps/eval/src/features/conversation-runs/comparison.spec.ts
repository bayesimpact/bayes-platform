import { describe, expect, it } from "vitest"
import { buildConversationRunRecord } from "@/test/factories/conversation-runs.factory"
import { comparisonRowsOf } from "./comparison"

describe("comparisonRowsOf", () => {
  it("gives one row per record of the dataset, with its record in each run", () => {
    const datasetRecordId = crypto.randomUUID()
    const first = buildConversationRunRecord({
      evaluationConversationDatasetRecordId: datasetRecordId,
      score: 4,
    })
    const second = buildConversationRunRecord({
      evaluationConversationDatasetRecordId: datasetRecordId,
      score: 2,
    })

    const rows = comparisonRowsOf([
      { runId: "first-run", records: [first] },
      { runId: "second-run", records: [second] },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.byRunId["first-run"]?.score).toBe(4)
    expect(rows[0]?.byRunId["second-run"]?.score).toBe(2)
  })

  it("keeps a record only one run asked, with nothing for the other run", () => {
    const shared = crypto.randomUUID()
    const rows = comparisonRowsOf([
      {
        runId: "all-records",
        records: [
          buildConversationRunRecord({ evaluationConversationDatasetRecordId: shared }),
          buildConversationRunRecord({
            evaluationConversationDatasetRecordId: crypto.randomUUID(),
          }),
        ],
      },
      {
        runId: "first-record",
        records: [buildConversationRunRecord({ evaluationConversationDatasetRecordId: shared })],
      },
    ])

    expect(rows).toHaveLength(2)
    expect(rows[1]?.byRunId["first-record"]).toBeUndefined()
  })

  it("matches the records whose dataset record was deleted by what they asked", () => {
    const asked = { input: "How do I reset my password?", expectedOutput: "From the sign-in page." }
    const rows = comparisonRowsOf([
      {
        runId: "first-run",
        records: [
          buildConversationRunRecord({ evaluationConversationDatasetRecordId: null, ...asked }),
        ],
      },
      {
        runId: "second-run",
        records: [
          buildConversationRunRecord({
            evaluationConversationDatasetRecordId: null,
            input: "Can I change my plan?",
            expectedOutput: "Yes, from the billing page.",
          }),
          buildConversationRunRecord({ evaluationConversationDatasetRecordId: null, ...asked }),
        ],
      },
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]?.input).toBe(asked.input)
    expect(Object.keys(rows[0]?.byRunId ?? {})).toEqual(["first-run", "second-run"])
    expect(Object.keys(rows[1]?.byRunId ?? {})).toEqual(["second-run"])
  })

  it("keeps apart the deleted records a run asked twice", () => {
    const asked = { input: "How do I reset my password?", expectedOutput: "From the sign-in page." }
    const deletedRecord = () =>
      buildConversationRunRecord({ evaluationConversationDatasetRecordId: null, ...asked })
    const rows = comparisonRowsOf([
      { runId: "first-run", records: [deletedRecord(), deletedRecord()] },
      { runId: "second-run", records: [deletedRecord()] },
    ])

    expect(rows).toHaveLength(2)
    expect(Object.keys(rows[0]?.byRunId ?? {})).toEqual(["first-run", "second-run"])
    expect(Object.keys(rows[1]?.byRunId ?? {})).toEqual(["first-run"])
  })
})
