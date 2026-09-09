import type { Repository } from "typeorm"
import type { Document } from "../document.entity"
import type { DocumentsService } from "../documents.service"
import type { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DOCUMENT_EMBEDDINGS_ENQUEUE_FAILED_ERROR_MESSAGE } from "./document-embeddings.constants"
import { DOCUMENT_EMBEDDINGS_STUCK_TIMEOUT_ERROR_MESSAGE } from "./document-embeddings-stuck.constants"
import { DocumentEmbeddingsStuckSweepService } from "./document-embeddings-stuck-sweep.service"

describe("DocumentEmbeddingsStuckSweepService", () => {
  const thresholdKey = "DOCUMENT_EMBEDDING_STUCK_THRESHOLD_SECONDS"
  const intervalKey = "DOCUMENT_EMBEDDING_STUCK_SWEEP_INTERVAL_SECONDS"
  const originalThreshold = process.env[thresholdKey]
  const originalInterval = process.env[intervalKey]

  afterAll(() => {
    if (originalThreshold === undefined) {
      delete process.env[thresholdKey]
    } else {
      process.env[thresholdKey] = originalThreshold
    }
    if (originalInterval === undefined) {
      delete process.env[intervalKey]
    } else {
      process.env[intervalKey] = originalInterval
    }
  })

  beforeEach(() => {
    process.env[thresholdKey] = "3600"
    process.env[intervalKey] = "60"
  })

  it("marks stuck queued/processing documents failed and notifies", async () => {
    const updatedAt = new Date("2020-01-01T00:00:00.000Z")
    const stuckDocument = {
      id: "doc-1",
      organizationId: "org-1",
      projectId: "proj-1",
      embeddingStatus: "processing",
      embeddingError: null,
      updatedAt,
    } as Document

    const getMany = jest.fn().mockResolvedValue([stuckDocument])
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany,
    }
    const documentRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<Document>

    const savedDocument = {
      ...stuckDocument,
      embeddingStatus: "failed" as const,
      embeddingError: DOCUMENT_EMBEDDINGS_STUCK_TIMEOUT_ERROR_MESSAGE,
      updatedAt: new Date("2026-05-04T12:00:00.000Z"),
    }
    const saveOne = jest.fn().mockResolvedValue(savedDocument)
    const documentsService = { saveOne } as unknown as DocumentsService

    const notifyEmbeddingStatusChanged = jest.fn().mockResolvedValue(undefined)
    const embeddingStatusNotifierService = {
      notifyEmbeddingStatusChanged,
    } as unknown as DocumentEmbeddingStatusNotifierService

    const service = new DocumentEmbeddingsStuckSweepService(
      documentRepository,
      documentsService,
      embeddingStatusNotifierService,
    )

    const result = await service.sweepStuckDocuments()

    expect(stuckDocument.embeddingStatus).toBe("failed")
    expect(stuckDocument.embeddingError).toBe(DOCUMENT_EMBEDDINGS_STUCK_TIMEOUT_ERROR_MESSAGE)
    expect(saveOne).toHaveBeenCalledWith(stuckDocument)
    expect(notifyEmbeddingStatusChanged).toHaveBeenCalledWith({
      documentId: savedDocument.id,
      organizationId: savedDocument.organizationId,
      projectId: savedDocument.projectId,
      embeddingStatus: savedDocument.embeddingStatus,
      embeddingError: savedDocument.embeddingError,
      updatedAt: savedDocument.updatedAt.getTime(),
    })
    expect(result).toEqual({ timedOutCount: 1 })
  })

  it("returns zero when no stuck documents", async () => {
    const getMany = jest.fn().mockResolvedValue([])
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany,
    }
    const documentRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<Document>

    const documentsService = { saveOne: jest.fn() } as unknown as DocumentsService
    const embeddingStatusNotifierService = {
      notifyEmbeddingStatusChanged: jest.fn(),
    } as unknown as DocumentEmbeddingStatusNotifierService

    const service = new DocumentEmbeddingsStuckSweepService(
      documentRepository,
      documentsService,
      embeddingStatusNotifierService,
    )

    const result = await service.sweepStuckDocuments()

    expect(result).toEqual({ timedOutCount: 0 })
    expect(documentsService.saveOne).not.toHaveBeenCalled()
  })

  it("marks uploaded project documents left pending as failed with the enqueue error", async () => {
    const pendingDocument = {
      id: "doc-2",
      organizationId: "org-1",
      projectId: "proj-1",
      sourceType: "project",
      uploadStatus: "uploaded",
      embeddingStatus: "pending",
      embeddingError: null,
      updatedAt: new Date("2020-01-01T00:00:00.000Z"),
    } as Document

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([pendingDocument]),
    }
    const documentRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<Document>

    const saveOne = jest.fn().mockImplementation((entity: Document) => Promise.resolve(entity))
    const notifyEmbeddingStatusChanged = jest.fn().mockResolvedValue(undefined)

    const service = new DocumentEmbeddingsStuckSweepService(
      documentRepository,
      { saveOne } as unknown as DocumentsService,
      { notifyEmbeddingStatusChanged } as unknown as DocumentEmbeddingStatusNotifierService,
    )

    const result = await service.sweepStuckDocuments()

    expect(pendingDocument.embeddingStatus).toBe("failed")
    expect(pendingDocument.embeddingError).toBe(DOCUMENT_EMBEDDINGS_ENQUEUE_FAILED_ERROR_MESSAGE)
    expect(notifyEmbeddingStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "doc-2", embeddingStatus: "failed" }),
    )
    expect(result).toEqual({ timedOutCount: 1 })
  })
})
