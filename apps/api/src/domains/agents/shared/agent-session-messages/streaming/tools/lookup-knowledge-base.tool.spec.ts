import {
  DEFAULT_TOP_K,
  fitChunksToBudget,
  lookupKnowledgeBaseTool,
  MAX_LOOKUP_OUTPUT_CHARACTERS,
} from "./lookup-knowledge-base.tool"
import { createRetrievedChunksRegistry } from "./retrieved-chunks-registry"

describe("lookupKnowledgeBaseTool", () => {
  it("retrieves chunks for a query alone", async () => {
    const onExecute = jest.fn()
    const retrievalService = {
      retrieveTopChunks: jest.fn().mockResolvedValue([]),
    }

    const sdkTool = lookupKnowledgeBaseTool({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      retrievalService: retrievalService as never,
      onExecute,
    })

    await sdkTool.execute?.(
      {
        query: "Combien d'enfants sont restes sans solution ?",
      },
      {} as never,
    )

    expect(retrievalService.retrieveTopChunks).toHaveBeenCalledWith({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      query: "Combien d'enfants sont restes sans solution ?",
      topK: DEFAULT_TOP_K,
      documentTagIds: [],
    })
  })

  it("retrieves chunks and returns metadata", async () => {
    const onExecute = jest.fn()
    const retrievalService = {
      retrieveTopChunks: jest.fn().mockResolvedValue([
        {
          chunkId: "chunk-1",
          documentId: "document-1",
          documentTitle: "Onboarding Guide",
          documentFileName: "guide.pdf",
          chunkIndex: 2,
          content: "The onboarding process lasts two weeks.",
          distance: 0.09,
          modelName: "gemini-embedding-001",
        },
      ]),
    }

    const retrievedChunksRegistry = createRetrievedChunksRegistry()
    const sdkTool = lookupKnowledgeBaseTool({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      retrievalService: retrievalService as never,
      retrievedChunksRegistry,
      onExecute,
    })

    const result = (await sdkTool.execute?.(
      {
        query: "How long does onboarding take?",
      },
      {} as never,
    )) as {
      retrievedChunks: unknown[]
      retrievalMetadata: {
        returnedChunkCount: number
        topK: number
      }
    }
    expect(result).toBeDefined()

    // The model only sees the alias + what it needs to answer; UUIDs and
    // retrieval internals stay server-side in the registry.
    expect(result.retrievedChunks).toEqual([
      {
        id: "c1",
        documentTitle: "Onboarding Guide",
        content: "The onboarding process lasts two weeks.",
      },
    ])
    expect(retrievedChunksRegistry.get("c1")?.chunkId).toBe("chunk-1")

    expect(retrievalService.retrieveTopChunks).toHaveBeenCalledWith({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      query: "How long does onboarding take?",
      topK: DEFAULT_TOP_K,
      documentTagIds: [],
    })
    expect(onExecute).toHaveBeenCalledWith({
      toolName: "lookup_knowledge_base",
      arguments: {
        query: "How long does onboarding take?",
        topK: DEFAULT_TOP_K,
        documentTagIds: [],
        retrievedChunkCount: 1,
        returnedChunkCount: 1,
        truncatedChunkCount: 0,
        chunkIds: ["chunk-1"],
        documentIds: ["document-1"],
      },
    })
    expect(result.retrievalMetadata).toEqual({
      returnedChunkCount: 1,
      topK: DEFAULT_TOP_K,
    })
  })

  it("passes agent document tags to retrieval", async () => {
    const onExecute = jest.fn()
    const retrievalService = {
      retrieveTopChunks: jest.fn().mockResolvedValue([]),
    }

    const sdkTool = lookupKnowledgeBaseTool({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      documentTagIds: ["tag-1", "tag-2"],
      retrievalService: retrievalService as never,
      onExecute,
    })

    await sdkTool.execute?.(
      {
        query: "Question",
      },
      {} as never,
    )

    expect(retrievalService.retrieveTopChunks).toHaveBeenCalledWith({
      connectScope: {
        organizationId: "organization-1",
        projectId: "project-1",
      },
      query: "Question",
      topK: DEFAULT_TOP_K,
      documentTagIds: ["tag-1", "tag-2"],
    })
    expect(onExecute).toHaveBeenCalledWith({
      toolName: "lookup_knowledge_base",
      arguments: {
        query: "Question",
        topK: DEFAULT_TOP_K,
        documentTagIds: ["tag-1", "tag-2"],
        retrievedChunkCount: 0,
        returnedChunkCount: 0,
        truncatedChunkCount: 0,
        chunkIds: [],
        documentIds: [],
      },
    })
  })

  describe("output budget", () => {
    const buildChunk = (index: number, content: string) => ({
      chunkId: `chunk-${index}`,
      documentId: `document-${index}`,
      documentTitle: `Document ${index}`,
      documentFileName: null,
      documentSourceType: "project",
      chunkIndex: 0,
      content,
      distance: index / 10,
      modelName: "gemini-embedding-001",
      isParentChunk: true,
    })

    it("fitChunksToBudget keeps chunks in order, cuts the first that overflows and drops the rest", () => {
      const { chunks, truncatedChunkCount } = fitChunksToBudget({
        chunks: [
          { content: "a".repeat(400) },
          { content: "b".repeat(400) },
          { content: "c".repeat(400) },
          { content: "d".repeat(100) },
        ],
        budget: 1_000,
      })

      expect(chunks.map((chunk) => chunk.content.length)).toEqual([400, 400, 200])
      expect(chunks[2]?.content).toBe("c".repeat(200))
      expect(truncatedChunkCount).toBe(1)
    })

    it("fitChunksToBudget stops before a chunk that would be cut to a stub", () => {
      const { chunks, truncatedChunkCount } = fitChunksToBudget({
        chunks: [{ content: "a".repeat(950) }, { content: "b".repeat(400) }],
        budget: 1_000,
      })

      expect(chunks).toHaveLength(1)
      expect(truncatedChunkCount).toBe(0)
    })

    it("fitChunksToBudget cuts a single chunk larger than the whole budget", () => {
      const { chunks, truncatedChunkCount } = fitChunksToBudget({
        chunks: [{ content: "a".repeat(5_000) }],
        budget: 1_000,
      })

      expect(chunks[0]?.content).toHaveLength(1_000)
      expect(truncatedChunkCount).toBe(1)
    })

    it("returns, registers and logs only the chunks within the budget", async () => {
      const onExecute = jest.fn()
      const halfBudget = MAX_LOOKUP_OUTPUT_CHARACTERS / 2
      const retrievalService = {
        retrieveTopChunks: jest
          .fn()
          .mockResolvedValue([
            buildChunk(1, "a".repeat(halfBudget)),
            buildChunk(2, "b".repeat(halfBudget)),
            buildChunk(3, "c".repeat(halfBudget)),
          ]),
      }
      const retrievedChunksRegistry = createRetrievedChunksRegistry()
      const sdkTool = lookupKnowledgeBaseTool({
        connectScope: { organizationId: "organization-1", projectId: "project-1" },
        retrievalService: retrievalService as never,
        retrievedChunksRegistry,
        onExecute,
      })

      const result = (await sdkTool.execute?.({ query: "Question" }, {} as never)) as {
        retrievedChunks: Array<{ id: string; content: string }>
        retrievalMetadata: { returnedChunkCount: number }
      }

      expect(result.retrievedChunks.map((chunk) => chunk.id)).toEqual(["c1", "c2"])
      expect(result.retrievedChunks.reduce((total, chunk) => total + chunk.content.length, 0)).toBe(
        MAX_LOOKUP_OUTPUT_CHARACTERS,
      )
      expect(result.retrievalMetadata.returnedChunkCount).toBe(2)
      expect(retrievedChunksRegistry.entries()).toHaveLength(2)
      expect(onExecute).toHaveBeenCalledWith({
        toolName: "lookup_knowledge_base",
        arguments: {
          query: "Question",
          topK: DEFAULT_TOP_K,
          documentTagIds: [],
          retrievedChunkCount: 3,
          returnedChunkCount: 2,
          truncatedChunkCount: 0,
          chunkIds: ["chunk-1", "chunk-2"],
          documentIds: ["document-1", "document-2"],
        },
      })
    })
  })
})
