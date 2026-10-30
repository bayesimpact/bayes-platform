import { EmbeddingModel, isLocalEmbeddingModel } from "@caseai-connect/api-contracts"
import { trace } from "@opentelemetry/api"
import { embed } from "ai"
import { DocumentChunkRetrievalService } from "./document-chunk-retrieval.service"
import { EmbedderService } from "./embedders/embedder.service"

const mockTextEmbeddingModel = jest.fn()
const mockCreateVertex = jest.fn((_config?: unknown) => ({
  textEmbeddingModel: mockTextEmbeddingModel,
}))

jest.mock("@ai-sdk/google-vertex", () => ({
  createVertex: (config: unknown) => mockCreateVertex(config),
}))

jest.mock("ai", () => ({
  embed: jest.fn(),
}))

function buildInnerQueryBuilderMock() {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    distinctOn: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getQuery: jest.fn().mockReturnValue("INNER_SQL"),
    getParameters: jest.fn().mockReturnValue({}),
  }
}

function buildOuterQueryBuilderMock(getRawMany: jest.Mock) {
  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany,
  }
}

const mockIsCompleted = jest.fn()
const mockHasEmbedding = jest.fn()
const mockHasAnyEmbedding = jest.fn()
const mockEmbedQueryLocally = jest.fn()
// Vertex goes through the real service (on the mocked AI SDK); self-hosted models are stubbed.
const vertexEmbedderService = new EmbedderService()
const embedderService = {
  embedQuery: (params: { modelName: string; text: string }) =>
    isLocalEmbeddingModel(params.modelName)
      ? mockEmbedQueryLocally(params)
      : vertexEmbedderService.embedQuery(params),
}

function buildService({
  innerQueryBuilder,
  outerQueryBuilder,
}: {
  innerQueryBuilder: ReturnType<typeof buildInnerQueryBuilderMock>
  outerQueryBuilder: ReturnType<typeof buildOuterQueryBuilderMock>
}) {
  return new DocumentChunkRetrievalService(
    {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(innerQueryBuilder)
        .mockReturnValueOnce(outerQueryBuilder),
    } as never,
    { isCompleted: mockIsCompleted } as never,
    embedderService as never,
    { hasEmbedding: mockHasEmbedding, hasAnyEmbedding: mockHasAnyEmbedding } as never,
  )
}

describe("DocumentChunkRetrievalService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_VERTEX_PROJECT = "test-project"
    process.env.GOOGLE_VERTEX_LOCATION = "us-central1"
    process.env.DOCUMENT_EMBEDDING_MODELS = "gemini-embedding-001"
    mockTextEmbeddingModel.mockReturnValue("embedding-model")
    mockIsCompleted.mockResolvedValue(false)
    mockHasEmbedding.mockResolvedValue(true)
    mockHasAnyEmbedding.mockResolvedValue(true)
  })

  it("retrieves with the agent's local model once the project has it ready", async () => {
    const getRawMany = jest.fn().mockResolvedValue([])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(getRawMany)
    mockIsCompleted.mockResolvedValue(true)
    mockEmbedQueryLocally.mockResolvedValue([0.4, 0.5])
    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    await service.retrieveTopChunks({
      connectScope: { organizationId: "organization-1", projectId: "project-1" },
      query: "question",
      embeddingModel: EmbeddingModel.BgeM3,
    })

    expect(mockEmbedQueryLocally).toHaveBeenCalledWith({
      modelName: EmbeddingModel.BgeM3,
      text: expect.stringContaining("question"),
    })
    expect(embed).not.toHaveBeenCalled()
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: EmbeddingModel.BgeM3,
    })
  })

  it("falls back to the default model when the local model is not ready", async () => {
    const getRawMany = jest.fn().mockResolvedValue([])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(getRawMany)
    mockIsCompleted.mockResolvedValue(false)
    const mockedEmbed = embed as jest.MockedFunction<typeof embed>
    mockedEmbed.mockResolvedValue({ embedding: [0.1] } as never)
    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    await service.retrieveTopChunks({
      connectScope: { organizationId: "organization-1", projectId: "project-1" },
      query: "question",
      embeddingModel: EmbeddingModel.BgeM3,
    })

    expect(mockEmbedQueryLocally).not.toHaveBeenCalled()
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: "gemini-embedding-001",
    })
  })

  it("falls back to the default model when the self-hosted embedder fails", async () => {
    const getRawMany = jest.fn().mockResolvedValue([])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(getRawMany)
    mockIsCompleted.mockResolvedValue(true)
    mockEmbedQueryLocally.mockRejectedValue(new Error("Embedder BAAI/bge-m3 answered 503"))
    const mockedEmbed = embed as jest.MockedFunction<typeof embed>
    mockedEmbed.mockResolvedValue({ embedding: [0.1] } as never)
    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    await service.retrieveTopChunks({
      connectScope: { organizationId: "organization-1", projectId: "project-1" },
      query: "question",
      embeddingModel: EmbeddingModel.BgeM3,
    })

    expect(mockedEmbed).toHaveBeenCalledTimes(1)
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: "gemini-embedding-001",
    })
  })

  it("keeps an agent on its Vertex model when the platform default changed", async () => {
    process.env.DOCUMENT_EMBEDDING_MODELS = "text-embedding-005,gemini-embedding-001"
    const getRawMany = jest.fn().mockResolvedValue([])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(getRawMany)
    const mockedEmbed = embed as jest.MockedFunction<typeof embed>
    mockedEmbed.mockResolvedValue({ embedding: [0.1] } as never)
    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    await service.retrieveTopChunks({
      connectScope: { organizationId: "organization-1", projectId: "project-1" },
      query: "question",
      embeddingModel: EmbeddingModel.GeminiEmbedding001,
    })

    expect(mockTextEmbeddingModel).toHaveBeenCalledWith("gemini-embedding-001")
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: "gemini-embedding-001",
    })
  })

  it("falls back to a configured model with vectors when the agent's model has none", async () => {
    process.env.DOCUMENT_EMBEDDING_MODELS = "gemini-embedding-001,text-embedding-005"
    mockHasEmbedding.mockImplementation(
      async ({ modelName }: { modelName: string }) => modelName === "text-embedding-005",
    )
    const getRawMany = jest.fn().mockResolvedValue([])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(getRawMany)
    const mockedEmbed = embed as jest.MockedFunction<typeof embed>
    mockedEmbed.mockResolvedValue({ embedding: [0.1] } as never)
    const setAttribute = jest.fn()
    const getActiveSpan = jest
      .spyOn(trace, "getActiveSpan")
      .mockReturnValue({ setAttribute } as never)
    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    await service.retrieveTopChunks({
      connectScope: { organizationId: "organization-1", projectId: "project-1" },
      query: "question",
      embeddingModel: EmbeddingModel.GeminiEmbedding001,
    })

    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: "text-embedding-005",
    })
    expect(setAttribute).toHaveBeenCalledWith(
      "ai.telemetry.metadata.embeddingFallbackFrom",
      "gemini-embedding-001",
    )
    getActiveSpan.mockRestore()
  })

  it("returns no passage and flags the trace when no model has the project's vectors", async () => {
    mockHasEmbedding.mockResolvedValue(false)
    const getRawMany = jest.fn()
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(getRawMany)
    const setAttribute = jest.fn()
    const getActiveSpan = jest
      .spyOn(trace, "getActiveSpan")
      .mockReturnValue({ setAttribute } as never)
    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    const chunks = await service.retrieveTopChunks({
      connectScope: { organizationId: "organization-1", projectId: "project-1" },
      query: "question",
      embeddingModel: EmbeddingModel.GeminiEmbedding001,
    })

    expect(chunks).toEqual([])
    expect(embed).not.toHaveBeenCalled()
    expect(getRawMany).not.toHaveBeenCalled()
    expect(setAttribute).toHaveBeenCalledWith("ai.telemetry.metadata.embeddingModelMissing", true)
    getActiveSpan.mockRestore()
  })

  it("stays quiet for a project that has no vector yet", async () => {
    mockHasEmbedding.mockResolvedValue(false)
    mockHasAnyEmbedding.mockResolvedValue(false)
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(jest.fn())
    const setAttribute = jest.fn()
    const getActiveSpan = jest
      .spyOn(trace, "getActiveSpan")
      .mockReturnValue({ setAttribute } as never)
    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    const chunks = await service.retrieveTopChunks({
      connectScope: { organizationId: "organization-1", projectId: "project-1" },
      query: "question",
    })

    expect(chunks).toEqual([])
    expect(setAttribute).not.toHaveBeenCalled()
    getActiveSpan.mockRestore()
  })

  it("records the model that embedded the query on the active span, with the fallback", async () => {
    const getRawMany = jest.fn().mockResolvedValue([])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(getRawMany)
    mockIsCompleted.mockResolvedValue(false)
    const mockedEmbed = embed as jest.MockedFunction<typeof embed>
    mockedEmbed.mockResolvedValue({ embedding: [0.1] } as never)
    const setAttribute = jest.fn()
    const getActiveSpan = jest
      .spyOn(trace, "getActiveSpan")
      .mockReturnValue({ setAttribute } as never)
    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    await service.retrieveTopChunks({
      connectScope: { organizationId: "organization-1", projectId: "project-1" },
      query: "question",
      embeddingModel: EmbeddingModel.BgeM3,
    })

    expect(setAttribute).toHaveBeenCalledWith(
      "ai.telemetry.metadata.embeddingModel",
      "gemini-embedding-001",
    )
    expect(setAttribute).toHaveBeenCalledWith(
      "ai.telemetry.metadata.embeddingFallbackFrom",
      EmbeddingModel.BgeM3,
    )
    getActiveSpan.mockRestore()
  })

  it("retrieves top chunks for a project scope", async () => {
    const getRawMany = jest.fn().mockResolvedValue([
      {
        chunkId: "chunk-1",
        documentId: "document-1",
        documentTitle: "Handbook",
        documentFileName: "handbook.pdf",
        chunkIndex: 0,
        content: "Relevant policy details",
        distance: 0.12,
        modelName: "gemini-embedding-001",
        isParentChunk: false,
      },
    ])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(getRawMany)
    const mockedEmbed = embed as jest.MockedFunction<typeof embed>
    mockedEmbed.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
    } as never)

    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    const chunks = await service.retrieveTopChunks({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      query: "What documents mention paid leave duration?",
      topK: 3,
    })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.documentId).toBe("document-1")
    expect(mockCreateVertex).toHaveBeenCalledWith({
      project: "test-project",
      location: "us-central1",
    })
    expect(mockTextEmbeddingModel).toHaveBeenCalledWith("gemini-embedding-001")
    expect(getRawMany).toHaveBeenCalledTimes(1)
    expect(outerQueryBuilder.limit).toHaveBeenCalledWith(3)
    expect(innerQueryBuilder.distinctOn).toHaveBeenCalledWith(["COALESCE(parent.id, chunk.id)"])
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith(
      "document.source_type IN (:...allowedSourceTypes)",
      {
        allowedSourceTypes: ["project", "webCrawl", "app"],
      },
    )
    expect(innerQueryBuilder.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining("document_document_tag"),
      expect.anything(),
    )
  })

  it("filters retrieved chunks by document tags when provided", async () => {
    const getRawMany = jest.fn().mockResolvedValue([])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const outerQueryBuilder = buildOuterQueryBuilderMock(getRawMany)
    const mockedEmbed = embed as jest.MockedFunction<typeof embed>
    mockedEmbed.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
    } as never)

    const service = buildService({ innerQueryBuilder, outerQueryBuilder })

    await service.retrieveTopChunks({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      query: "Show me tagged docs only.",
      topK: 3,
      documentTagIds: ["tag-1", "tag-2", "tag-1"],
    })

    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("document_document_tag"),
      { documentTagIds: ["tag-1", "tag-2"] },
    )
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("document_source_document_tag"),
      { documentTagIds: ["tag-1", "tag-2"] },
    )
  })
})
