import { createVertex } from "@ai-sdk/google-vertex"
import { embedMany } from "ai"
import type { DataSource } from "typeorm"
import type { Document } from "../document.entity"
import type { DocumentsService } from "../documents.service"
import type { IFileStorage } from "../storage/file-storage.interface"
import type { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DocumentEmbeddingsProcessorService } from "./document-embeddings-processor.service"
import type { DocumentTextExtractorService } from "./document-text-extractor.service"

jest.mock("@ai-sdk/google-vertex", () => ({
  createVertex: jest.fn(),
}))

jest.mock("ai", () => ({
  embedMany: jest.fn(),
}))

type DocumentEmbeddingsProcessorInternals = {
  findDocument: (payload: Record<string, string>) => Promise<Document | null>
  extractDocumentChunks: (
    document: Document,
  ) => Promise<{ chunks: string[]; extractionEngine: Document["extractionEngine"] }>
  generateEmbeddingsByModel: (chunks: string[]) => Promise<Map<string, number[][]>>
  insertChunks: (params: Record<string, unknown>) => Promise<void>
  markDocumentStatus: (document: Document, status: Document["embeddingStatus"]) => Promise<void>
}

describe("DocumentEmbeddingsProcessorService", () => {
  it("persists extraction engine metadata before marking completed", async () => {
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
    const serviceInternals = service as unknown as DocumentEmbeddingsProcessorInternals

    jest.spyOn(serviceInternals, "findDocument").mockResolvedValue(document)
    jest.spyOn(serviceInternals, "extractDocumentChunks").mockResolvedValue({
      chunks: ["chunk content"],
      extractionEngine: "docling@2.51.0",
    })
    jest
      .spyOn(serviceInternals, "generateEmbeddingsByModel")
      .mockResolvedValue(new Map([["gemini-embedding-001", [[0.1, 0.2, 0.3]]]]))
    jest.spyOn(serviceInternals, "insertChunks").mockResolvedValue(undefined)
    jest.spyOn(serviceInternals, "markDocumentStatus").mockImplementation(async (doc, status) => {
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
    const serviceInternals = service as unknown as DocumentEmbeddingsProcessorInternals
    const extractionError = new Error(
      "Docling produced no embed_text chunks for MIME type: image/png",
    )

    jest.spyOn(serviceInternals, "findDocument").mockResolvedValue(document)
    jest.spyOn(serviceInternals, "extractDocumentChunks").mockRejectedValue(extractionError)
    jest.spyOn(serviceInternals, "generateEmbeddingsByModel")
    jest.spyOn(serviceInternals, "insertChunks")
    jest.spyOn(serviceInternals, "markDocumentStatus").mockImplementation(async (doc, status) => {
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
    expect(serviceInternals.generateEmbeddingsByModel).not.toHaveBeenCalled()
    expect(serviceInternals.insertChunks).not.toHaveBeenCalled()
  })

  it("batches embedding requests to stay under Vertex instance limits", async () => {
    process.env.GOOGLE_VERTEX_PROJECT = "project-id"
    process.env.GOOGLE_VERTEX_LOCATION = "europe-west1"
    process.env.DOCUMENT_EMBEDDING_MODELS = "gemini-embedding-001"

    const mockTextEmbeddingModel = jest.fn().mockReturnValue("embedding-model")
    const mockedCreateVertex = jest.mocked(createVertex)
    mockedCreateVertex.mockReturnValue({
      textEmbeddingModel: mockTextEmbeddingModel,
    } as unknown as ReturnType<typeof createVertex>)

    const mockedEmbedMany = jest.mocked(embedMany)
    mockedEmbedMany.mockImplementation(async ({ values }) => ({
      embeddings: values.map(() => [0.1, 0.2, 0.3]),
      values,
      warnings: [],
      usage: { tokens: 0 },
    }))

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

    const chunks = Array.from({ length: 501 }, (_, index) => `chunk-${index}`)
    const embeddingsByModelName = await serviceInternals.generateEmbeddingsByModel(chunks)
    const embeddings = embeddingsByModelName.get("gemini-embedding-001")

    expect(mockedEmbedMany).toHaveBeenCalledTimes(3)
    expect(mockedEmbedMany.mock.calls[0]?.[0].values).toHaveLength(250)
    expect(mockedEmbedMany.mock.calls[1]?.[0].values).toHaveLength(250)
    expect(mockedEmbedMany.mock.calls[2]?.[0].values).toHaveLength(1)
    expect(embeddings).toHaveLength(501)
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
