// Provide an explicit factory so Jest never evaluates the real CJS module.
// Without it, Jest's auto-mock still loads the module to inspect its exports,
// which triggers @llamaindex/env's singleton guard ("llamaindex was already imported").
jest.mock("@llamaindex/readers/pdf", () => ({ PDFReader: jest.fn() }))

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
