import type { Job } from "bullmq"
import { describeFailedJob } from "./describe-failed-job"

describe("describeFailedJob", () => {
  const job = { name: "create-embeddings", id: "2350" } as Job

  it("puts the cause before the job id", () => {
    expect(describeFailedJob(job, new Error("Docling produced no chunks"))).toBe(
      "create-embeddings: Docling produced no chunks (job 2350)",
    )
  })

  it("keeps only the first line of the message", () => {
    const error = new Error(
      "Document chunker failed: PermissionError\nTraceback (most recent call)",
    )
    expect(describeFailedJob(job, error)).toBe(
      "create-embeddings: Document chunker failed: PermissionError (job 2350)",
    )
  })

  it("falls back to the error name when the message is empty", () => {
    expect(describeFailedJob(job, new TypeError(""))).toBe(
      "create-embeddings: TypeError (job 2350)",
    )
  })

  it("cuts a long cause", () => {
    const description = describeFailedJob(job, new Error("x".repeat(1000)))
    expect(description).toBe(`create-embeddings: ${"x".repeat(300)} (job 2350)`)
  })

  it("names an unknown job", () => {
    expect(describeFailedJob(undefined, new Error("boom"))).toBe("unknown: boom (job unknown)")
  })
})
