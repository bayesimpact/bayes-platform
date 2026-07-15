import { createVertex } from "@ai-sdk/google-vertex"
import { embedMany } from "ai"
import type { DataSource } from "typeorm"
import type { DocumentsService } from "../documents.service"
import type { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DocumentEmbeddingsSharedService } from "./document-embeddings-shared.service"

jest.mock("@ai-sdk/google-vertex", () => ({
  createVertex: jest.fn(),
}))

jest.mock("ai", () => ({
  embedMany: jest.fn(),
}))

type SharedServiceInternals = {
  generateEmbeddingsByModel: (chunks: string[]) => Promise<Map<string, number[][]>>
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

describe("DocumentEmbeddingsSharedService", () => {
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

    const service = buildSharedService()
    const serviceInternals = service as unknown as SharedServiceInternals

    const chunks = Array.from({ length: 501 }, (_, index) => `chunk-${index}`)
    const embeddingsByModelName = await serviceInternals.generateEmbeddingsByModel(chunks)
    const embeddings = embeddingsByModelName.get("gemini-embedding-001")

    expect(mockedEmbedMany).toHaveBeenCalledTimes(3)
    expect(mockedEmbedMany.mock.calls[0]?.[0].values).toHaveLength(250)
    expect(mockedEmbedMany.mock.calls[1]?.[0].values).toHaveLength(250)
    expect(mockedEmbedMany.mock.calls[2]?.[0].values).toHaveLength(1)
    expect(embeddings).toHaveLength(501)
  })
})
