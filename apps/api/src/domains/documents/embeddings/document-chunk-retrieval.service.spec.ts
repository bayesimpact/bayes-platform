import { EmbeddingModel } from "@caseai-connect/api-contracts"
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

const mockListCompletedModelNames = jest.fn()
const mockEmbedQueryOverHttp = jest.fn()
// Vertex goes through the real service (on the mocked AI SDK); bge-m3 is stubbed.
const vertexEmbedderService = new EmbedderService()
const embedderService = {
  embedQuery: (params: { modelName: string; text: string }) =>
    params.modelName === EmbeddingModel.BgeM3
      ? mockEmbedQueryOverHttp(params)
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
    { listCompletedModelNames: mockListCompletedModelNames } as never,
    embedderService as never,
  )
}

const connectScope = { organizationId: "organization-1", projectId: "project-1" }

function spyOnActiveSpan() {
  const setAttribute = jest.fn()
  const getActiveSpan = jest
    .spyOn(trace, "getActiveSpan")
    .mockReturnValue({ setAttribute } as never)
  return { setAttribute, restore: () => getActiveSpan.mockRestore() }
}

describe("DocumentChunkRetrievalService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_VERTEX_PROJECT = "test-project"
    process.env.GOOGLE_VERTEX_LOCATION = "us-central1"
    mockTextEmbeddingModel.mockReturnValue("embedding-model")
    mockListCompletedModelNames.mockResolvedValue([EmbeddingModel.GeminiEmbedding001])
    const mockedEmbed = embed as jest.MockedFunction<typeof embed>
    mockedEmbed.mockResolvedValue({ embedding: [0.1] } as never)
  })

  it("retrieves with the agent's model once the project finished embedding with it", async () => {
    mockListCompletedModelNames.mockResolvedValue([
      EmbeddingModel.GeminiEmbedding001,
      EmbeddingModel.BgeM3,
    ])
    mockEmbedQueryOverHttp.mockResolvedValue([0.4, 0.5])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const service = buildService({
      innerQueryBuilder,
      outerQueryBuilder: buildOuterQueryBuilderMock(jest.fn().mockResolvedValue([])),
    })

    await service.retrieveTopChunks({
      connectScope,
      query: "question",
      embeddingModel: EmbeddingModel.BgeM3,
    })

    expect(mockEmbedQueryOverHttp).toHaveBeenCalledWith({
      modelName: EmbeddingModel.BgeM3,
      text: expect.stringContaining("question"),
    })
    expect(embed).not.toHaveBeenCalled()
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: EmbeddingModel.BgeM3,
    })
  })

  it("uses the project's default model when the agent names none", async () => {
    mockListCompletedModelNames.mockResolvedValue([
      EmbeddingModel.BgeM3,
      EmbeddingModel.GeminiEmbedding001,
    ])
    mockEmbedQueryOverHttp.mockResolvedValue([0.4, 0.5])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const service = buildService({
      innerQueryBuilder,
      outerQueryBuilder: buildOuterQueryBuilderMock(jest.fn().mockResolvedValue([])),
    })

    await service.retrieveTopChunks({ connectScope, query: "question" })

    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: EmbeddingModel.BgeM3,
    })
  })

  it("keeps an agent on its model when the project's default is another one", async () => {
    mockListCompletedModelNames.mockResolvedValue([
      EmbeddingModel.BgeM3,
      EmbeddingModel.GeminiEmbedding001,
    ])
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const service = buildService({
      innerQueryBuilder,
      outerQueryBuilder: buildOuterQueryBuilderMock(jest.fn().mockResolvedValue([])),
    })

    await service.retrieveTopChunks({
      connectScope,
      query: "question",
      embeddingModel: EmbeddingModel.GeminiEmbedding001,
    })

    expect(mockEmbedQueryOverHttp).not.toHaveBeenCalled()
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: EmbeddingModel.GeminiEmbedding001,
    })
  })

  it("falls back to the project's default and flags the trace when the agent's model is not ready", async () => {
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const span = spyOnActiveSpan()
    const service = buildService({
      innerQueryBuilder,
      outerQueryBuilder: buildOuterQueryBuilderMock(jest.fn().mockResolvedValue([])),
    })

    await service.retrieveTopChunks({
      connectScope,
      query: "question",
      embeddingModel: EmbeddingModel.BgeM3,
    })

    expect(mockEmbedQueryOverHttp).not.toHaveBeenCalled()
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: EmbeddingModel.GeminiEmbedding001,
    })
    expect(span.setAttribute).toHaveBeenCalledWith(
      "ai.telemetry.metadata.embeddingModel",
      EmbeddingModel.GeminiEmbedding001,
    )
    expect(span.setAttribute).toHaveBeenCalledWith(
      "ai.telemetry.metadata.embeddingFallbackFrom",
      EmbeddingModel.BgeM3,
    )
    span.restore()
  })

  it("moves to the next ready model when the agent's embedder fails", async () => {
    mockListCompletedModelNames.mockResolvedValue([
      EmbeddingModel.GeminiEmbedding001,
      EmbeddingModel.BgeM3,
    ])
    mockEmbedQueryOverHttp.mockRejectedValue(new Error("Embedder BAAI/bge-m3 answered 503"))
    const innerQueryBuilder = buildInnerQueryBuilderMock()
    const service = buildService({
      innerQueryBuilder,
      outerQueryBuilder: buildOuterQueryBuilderMock(jest.fn().mockResolvedValue([])),
    })

    await service.retrieveTopChunks({
      connectScope,
      query: "question",
      embeddingModel: EmbeddingModel.BgeM3,
    })

    expect(embed).toHaveBeenCalledTimes(1)
    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith("embedding.model_name = :modelName", {
      modelName: EmbeddingModel.GeminiEmbedding001,
    })
  })

  it("returns no passage and flags the trace when the project has no ready model", async () => {
    mockListCompletedModelNames.mockResolvedValue([])
    const getRawMany = jest.fn()
    const span = spyOnActiveSpan()
    const service = buildService({
      innerQueryBuilder: buildInnerQueryBuilderMock(),
      outerQueryBuilder: buildOuterQueryBuilderMock(getRawMany),
    })

    const chunks = await service.retrieveTopChunks({
      connectScope,
      query: "question",
      embeddingModel: EmbeddingModel.GeminiEmbedding001,
    })

    expect(chunks).toEqual([])
    expect(embed).not.toHaveBeenCalled()
    expect(getRawMany).not.toHaveBeenCalled()
    expect(span.setAttribute).toHaveBeenCalledWith(
      "ai.telemetry.metadata.embeddingModelMissing",
      true,
    )
    span.restore()
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
