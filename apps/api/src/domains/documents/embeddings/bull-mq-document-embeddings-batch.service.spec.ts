import { ServiceUnavailableException } from "@nestjs/common"
import type { Queue } from "bullmq"
import { BullMqDocumentEmbeddingsBatchService } from "./bull-mq-document-embeddings-batch.service"
import type { DocumentEmbeddingQueueSyncService } from "./document-embedding-queue-sync.service"
import {
  DOCUMENT_EMBEDDINGS_ENQUEUE_TIMEOUT_MS,
  DOCUMENT_EMBEDDINGS_JOB_NAME,
} from "./document-embeddings.constants"

describe("BullMqDocumentEmbeddingsBatchService", () => {
  it("adds a create-embeddings job then marks document queued and notifies", async () => {
    const addJob = jest.fn().mockResolvedValue(undefined)
    const queue = { add: addJob } as unknown as Queue

    const payload = {
      documentId: "document-id",
      organizationId: "organization-id",
      projectId: "project-id",
      uploadedByUserId: "user-id",
      origin: "document-upload" as const,
      currentTraceId: "trace-id",
    }

    const afterEnqueuePatch = {
      embeddingStatus: "queued" as const,
      embeddingError: null,
      updatedAt: new Date("2026-05-04T12:00:00.000Z"),
    }
    const markDocumentAsQueuedAndNotify = jest.fn().mockResolvedValue(afterEnqueuePatch)
    const documentEmbeddingQueueSyncService = {
      markDocumentAsQueuedAndNotify,
    } as unknown as DocumentEmbeddingQueueSyncService

    const service = new BullMqDocumentEmbeddingsBatchService(
      queue,
      documentEmbeddingQueueSyncService,
    )

    const result = await service.enqueueCreateEmbeddingsForDocument(payload)

    expect(addJob).toHaveBeenCalledWith(DOCUMENT_EMBEDDINGS_JOB_NAME, payload)
    expect(markDocumentAsQueuedAndNotify).toHaveBeenCalledWith(payload)
    expect(result).toBe(afterEnqueuePatch)
  })

  const payload = {
    documentId: "document-id",
    organizationId: "organization-id",
    projectId: "project-id",
    uploadedByUserId: "user-id",
    origin: "document-upload" as const,
    currentTraceId: "trace-id",
  }

  function buildService(addJob: jest.Mock) {
    const queue = { add: addJob } as unknown as Queue
    const markDocumentAsQueuedAndNotify = jest.fn().mockResolvedValue(undefined)
    const markDocumentAsEnqueueFailedAndNotify = jest.fn().mockResolvedValue(undefined)
    const service = new BullMqDocumentEmbeddingsBatchService(queue, {
      markDocumentAsQueuedAndNotify,
      markDocumentAsEnqueueFailedAndNotify,
    } as unknown as DocumentEmbeddingQueueSyncService)
    return { service, markDocumentAsQueuedAndNotify, markDocumentAsEnqueueFailedAndNotify }
  }

  it("marks the document failed and throws 503 when the queue rejects the job", async () => {
    const { service, markDocumentAsQueuedAndNotify, markDocumentAsEnqueueFailedAndNotify } =
      buildService(jest.fn().mockRejectedValue(new Error("Connection is closed.")))

    await expect(service.enqueueCreateEmbeddingsForDocument(payload)).rejects.toThrow(
      ServiceUnavailableException,
    )
    expect(markDocumentAsEnqueueFailedAndNotify).toHaveBeenCalledWith(payload)
    expect(markDocumentAsQueuedAndNotify).not.toHaveBeenCalled()
  })

  it("marks the document failed and throws 503 when the queue never answers", async () => {
    jest.useFakeTimers()
    try {
      const { service, markDocumentAsEnqueueFailedAndNotify } = buildService(
        jest.fn().mockReturnValue(new Promise(() => {})),
      )

      const enqueuePromise = service.enqueueCreateEmbeddingsForDocument(payload)
      const assertion = expect(enqueuePromise).rejects.toThrow(ServiceUnavailableException)
      await jest.advanceTimersByTimeAsync(DOCUMENT_EMBEDDINGS_ENQUEUE_TIMEOUT_MS)
      await assertion
      expect(markDocumentAsEnqueueFailedAndNotify).toHaveBeenCalledWith(payload)
    } finally {
      jest.useRealTimers()
    }
  })

  it("still throws 503 when marking the document failed also fails", async () => {
    const queue = { add: jest.fn().mockRejectedValue(new Error("boom")) } as unknown as Queue
    const service = new BullMqDocumentEmbeddingsBatchService(queue, {
      markDocumentAsQueuedAndNotify: jest.fn(),
      markDocumentAsEnqueueFailedAndNotify: jest.fn().mockRejectedValue(new Error("db down")),
    } as unknown as DocumentEmbeddingQueueSyncService)

    await expect(service.enqueueCreateEmbeddingsForDocument(payload)).rejects.toThrow(
      ServiceUnavailableException,
    )
  })
})
