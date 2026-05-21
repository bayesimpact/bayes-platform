import type { Job } from "bullmq"
import type { DocumentEmbeddingsStuckSweepService } from "./document-embeddings-stuck-sweep.service"
import { DocumentEmbeddingsStuckSweepWorker } from "./document-embeddings-stuck-sweep.worker"

describe("DocumentEmbeddingsStuckSweepWorker", () => {
  it("runs the sweep", async () => {
    const sweepStuckDocuments = jest.fn().mockResolvedValue({ timedOutCount: 2 })
    const stuckSweepService = {
      sweepStuckDocuments,
    } as unknown as DocumentEmbeddingsStuckSweepService

    const worker = new DocumentEmbeddingsStuckSweepWorker(stuckSweepService)
    const job = { id: "job-1" } as unknown as Job

    await worker.process(job)

    expect(sweepStuckDocuments).toHaveBeenCalledTimes(1)
  })
})
