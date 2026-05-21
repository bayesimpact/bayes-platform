import { embed } from "ai"
import { DocumentChunkRetrievalService } from "./document-chunk-retrieval.service"

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

describe("DocumentChunkRetrievalService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GOOGLE_VERTEX_PROJECT = "test-project"
    process.env.GOOGLE_VERTEX_LOCATION = "us-central1"
    process.env.DOCUMENT_EMBEDDING_MODELS = "gemini-embedding-001"
    mockTextEmbeddingModel.mockReturnValue("embedding-model")
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

    const service = new DocumentChunkRetrievalService({
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(innerQueryBuilder)
        .mockReturnValueOnce(outerQueryBuilder),
    } as never)

    const chunks = await service.retrieveTopChunks({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      conversationSummary: "User discussed parental leave policy.",
      latestUserQuestion: "What documents mention paid leave duration?",
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
        allowedSourceTypes: ["project", "webCrawl"],
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

    const service = new DocumentChunkRetrievalService({
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(innerQueryBuilder)
        .mockReturnValueOnce(outerQueryBuilder),
    } as never)

    await service.retrieveTopChunks({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      conversationSummary: "User asked for policies.",
      latestUserQuestion: "Show me tagged docs only.",
      topK: 3,
      documentTagIds: ["tag-1", "tag-2", "tag-1"],
    })

    expect(innerQueryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("document_document_tag"),
      { documentTagIds: ["tag-1", "tag-2"] },
    )
  })
})
