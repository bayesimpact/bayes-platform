import { DocumentEmbeddingsWorker } from "./document-embeddings.worker"
import type { DocumentEmbeddingsProcessorService } from "./document-embeddings-processor.service"

describe("DocumentEmbeddingsWorker", () => {
  it("delegates jobs to the processor service", async () => {
    const mockProcessorService = {
      processDocument: jest.fn().mockResolvedValue(undefined),
    } as unknown as DocumentEmbeddingsProcessorService

    const worker = new DocumentEmbeddingsWorker(mockProcessorService)

    const jobData = {
      documentId: "document-id",
      organizationId: "organization-id",
      projectId: "project-id",
      uploadedByUserId: "user-id",
      origin: "document-upload" as const,
      currentTraceId: "trace-id",
    }
    const job = { data: jobData }

    await worker.process(job as never)

    expect(mockProcessorService.processDocument).toHaveBeenCalledWith(jobData)
  })
})
