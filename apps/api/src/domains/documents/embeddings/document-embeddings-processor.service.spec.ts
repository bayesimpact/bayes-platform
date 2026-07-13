import type { DataSource } from "typeorm"
import type { Document } from "../document.entity"
import type { DocumentsService } from "../documents.service"
import type { IFileStorage } from "../storage/file-storage.interface"
import type { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DocumentEmbeddingsProcessorService } from "./document-embeddings-processor.service"
import { DocumentEmbeddingsSharedService } from "./document-embeddings-shared.service"
import type { DocumentTextExtractorService } from "./document-text-extractor.service"

type ProcessorInternals = {
  extractDocumentChunks: (
    document: Document,
  ) => Promise<{ chunks: string[]; extractionEngine: Document["extractionEngine"] }>
}

type SharedServiceInternals = {
  findDocumentOrThrow: (payload: Record<string, string>) => Promise<Document>
  generateEmbeddingsByModel: (chunks: string[]) => Promise<Map<string, number[][]>>
  insertChunks: (params: Record<string, unknown>) => Promise<void>
  markDocumentStatus: (document: Document, status: Document["embeddingStatus"]) => Promise<void>
}

function buildSharedService(): DocumentEmbeddingsSharedService {
  const documentsService = {} as DocumentsService
  const embeddingStatusNotifierService = {} as DocumentEmbeddingStatusNotifierService
  const dataSource = { query: jest.fn() } as unknown as DataSource
  return new DocumentEmbeddingsSharedService(
    documentsService,
    embeddingStatusNotifierService,
    dataSource,
  )
}

function buildProcessorService(
  sharedService: DocumentEmbeddingsSharedService,
): DocumentEmbeddingsProcessorService {
  const textExtractorService = {} as DocumentTextExtractorService
  const fileStorage = {} as IFileStorage
  return new DocumentEmbeddingsProcessorService(sharedService, textExtractorService, fileStorage)
}

describe("DocumentEmbeddingsProcessorService", () => {
  it("persists extraction engine metadata before marking completed", async () => {
    const sharedService = buildSharedService()
    const service = buildProcessorService(sharedService)

    const sharedInternals = sharedService as unknown as SharedServiceInternals
    const processorInternals = service as unknown as ProcessorInternals

    const document = {
      id: "document-id",
      organizationId: "organization-id",
      projectId: "project-id",
      mimeType: "application/pdf",
      storageRelativePath: "documents/path/file.pdf",
      embeddingError: null,
      extractionEngine: null,
    } as Document

    const statusTransitions: Array<{
      status: string
      embeddingError: Document["embeddingError"]
      extractionEngine: Document["extractionEngine"]
    }> = []

    jest.spyOn(sharedInternals, "findDocumentOrThrow").mockResolvedValue(document)
    jest.spyOn(processorInternals, "extractDocumentChunks").mockResolvedValue({
      chunks: ["chunk content"],
      extractionEngine: "docling@2.51.0",
    })
    jest
      .spyOn(sharedInternals, "generateEmbeddingsByModel")
      .mockResolvedValue(new Map([["gemini-embedding-001", [[0.1, 0.2, 0.3]]]]))
    jest.spyOn(sharedInternals, "insertChunks").mockResolvedValue(undefined)
    jest.spyOn(sharedInternals, "markDocumentStatus").mockImplementation(async (doc, status) => {
      statusTransitions.push({
        status,
        embeddingError: doc.embeddingError,
        extractionEngine: doc.extractionEngine,
      })
    })

    await service.processDocument({
      documentId: "document-id",
      organizationId: "organization-id",
      projectId: "project-id",
      uploadedByUserId: "user-id",
      origin: "document-upload",
      currentTraceId: "trace-id",
    })

    expect(statusTransitions).toEqual([
      { status: "processing", embeddingError: null, extractionEngine: null },
      { status: "completed", embeddingError: null, extractionEngine: "docling@2.51.0" },
    ])
  })

  it("persists a readable embedding error before marking failed", async () => {
    const sharedService = buildSharedService()
    const service = buildProcessorService(sharedService)

    const sharedInternals = sharedService as unknown as SharedServiceInternals
    const processorInternals = service as unknown as ProcessorInternals

    const document = {
      id: "document-id",
      organizationId: "organization-id",
      projectId: "project-id",
      mimeType: "application/pdf",
      storageRelativePath: "documents/path/file.pdf",
      embeddingError: null,
      extractionEngine: null,
    } as Document

    const statusTransitions: Array<{
      status: string
      embeddingError: Document["embeddingError"]
    }> = []
    const extractionError = new Error(
      "Docling produced no embed_text chunks for MIME type: image/png",
    )

    jest.spyOn(sharedInternals, "findDocumentOrThrow").mockResolvedValue(document)
    jest.spyOn(processorInternals, "extractDocumentChunks").mockRejectedValue(extractionError)
    jest.spyOn(sharedInternals, "generateEmbeddingsByModel")
    jest.spyOn(sharedInternals, "insertChunks")
    jest.spyOn(sharedInternals, "markDocumentStatus").mockImplementation(async (doc, status) => {
      statusTransitions.push({
        status,
        embeddingError: doc.embeddingError,
      })
    })

    await expect(
      service.processDocument({
        documentId: "document-id",
        organizationId: "organization-id",
        projectId: "project-id",
        uploadedByUserId: "user-id",
        origin: "document-upload",
        currentTraceId: "trace-id",
      }),
    ).rejects.toThrow(extractionError)

    expect(statusTransitions).toEqual([
      { status: "processing", embeddingError: null },
      {
        status: "failed",
        embeddingError: "Docling produced no embed_text chunks for MIME type: image/png",
      },
    ])
    expect(sharedInternals.generateEmbeddingsByModel).not.toHaveBeenCalled()
    expect(sharedInternals.insertChunks).not.toHaveBeenCalled()
  })

  it("processDocument - should works when document is not found", async () => {
    const documentsService = {} as DocumentsService
    const textExtractorService = {} as DocumentTextExtractorService
    const embeddingStatusNotifierService = {} as DocumentEmbeddingStatusNotifierService
    const fileStorage = {} as IFileStorage
    const dataSource = { query: jest.fn() } as unknown as DataSource

    const service = new DocumentEmbeddingsProcessorService(
      documentsService,
      textExtractorService,
      embeddingStatusNotifierService,
      fileStorage,
      dataSource,
    )

    const serviceInternals = service as unknown as DocumentEmbeddingsProcessorInternals
    jest.spyOn(serviceInternals, "findDocument").mockResolvedValue(null)
    jest.spyOn(serviceInternals, "markDocumentStatus")
    jest.spyOn(serviceInternals, "extractDocumentChunks")
    jest.spyOn(serviceInternals, "generateEmbeddingsByModel")
    jest.spyOn(serviceInternals, "insertChunks")

    await expect(
      service.processDocument({
        documentId: "not-found-document-id",
        organizationId: "organization-id",
        projectId: "project-id",
        uploadedByUserId: "user-id",
        origin: "document-upload",
        currentTraceId: "trace-id",
      }),
    ).resolves.toBeUndefined()

    expect(serviceInternals.markDocumentStatus).not.toHaveBeenCalled()
    expect(serviceInternals.extractDocumentChunks).not.toHaveBeenCalled()
    expect(serviceInternals.generateEmbeddingsByModel).not.toHaveBeenCalled()
    expect(serviceInternals.insertChunks).not.toHaveBeenCalled()
  })
})
