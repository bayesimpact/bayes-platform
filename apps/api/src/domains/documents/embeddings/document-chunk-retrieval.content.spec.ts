import { type RetrievedChunkRow, toRetrievedChunks } from "./document-chunk-retrieval.content"

const buildRow = (overrides: Partial<RetrievedChunkRow> = {}): RetrievedChunkRow => ({
  chunkId: "chunk-1",
  documentId: "document-1",
  documentTitle: "Handbook",
  documentFileName: "handbook.pdf",
  documentSourceType: "project",
  chunkIndex: 1,
  content: "Matching passage.",
  distance: 0.1,
  modelName: "gemini-embedding-001",
  isParentChunk: false,
  hasOversizedParent: false,
  childParentId: null,
  previousChunkId: null,
  previousContent: null,
  nextChunkId: null,
  nextContent: null,
  ...overrides,
})

describe("toRetrievedChunks", () => {
  it("returns a section that fits as it is, without the query's working columns", () => {
    const chunks = toRetrievedChunks({
      rows: [buildRow({ chunkId: "parent-1", content: "Whole section.", isParentChunk: true })],
      maxChunkCharacters: 100,
    })

    expect(chunks).toEqual([
      {
        chunkId: "parent-1",
        documentId: "document-1",
        documentTitle: "Handbook",
        documentFileName: "handbook.pdf",
        documentSourceType: "project",
        chunkIndex: 1,
        content: "Whole section.",
        distance: 0.1,
        modelName: "gemini-embedding-001",
        isParentChunk: true,
      },
    ])
  })

  it("returns the passage between its neighbours when its section is too large", () => {
    const [chunk] = toRetrievedChunks({
      rows: [
        buildRow({
          hasOversizedParent: true,
          childParentId: "parent-1",
          previousChunkId: "chunk-0",
          previousContent: "Passage before.",
          nextChunkId: "chunk-2",
          nextContent: "Passage after.",
        }),
      ],
      maxChunkCharacters: 100,
    })

    expect(chunk?.content).toBe("Passage before.\n\nMatching passage.\n\nPassage after.")
    expect(chunk?.chunkId).toBe("chunk-1")
    expect(chunk?.isParentChunk).toBe(false)
  })

  it("skips a missing neighbour", () => {
    const [chunk] = toRetrievedChunks({
      rows: [
        buildRow({
          hasOversizedParent: true,
          nextChunkId: "chunk-2",
          nextContent: "Passage after.",
        }),
      ],
      maxChunkCharacters: 100,
    })

    expect(chunk?.content).toBe("Matching passage.\n\nPassage after.")
  })

  it("leaves out a neighbour that would push the hit over the limit", () => {
    const [chunk] = toRetrievedChunks({
      rows: [
        buildRow({
          hasOversizedParent: true,
          previousChunkId: "chunk-0",
          previousContent: "a".repeat(90),
          nextChunkId: "chunk-2",
          nextContent: "Passage after.",
        }),
      ],
      maxChunkCharacters: 40,
    })

    expect(chunk?.content).toBe("Matching passage.\n\nPassage after.")
  })

  it("does not repeat a neighbour that is a hit itself or already beside a better hit", () => {
    const chunks = toRetrievedChunks({
      rows: [
        buildRow({
          chunkId: "chunk-1",
          content: "One.",
          hasOversizedParent: true,
          nextChunkId: "chunk-2",
          nextContent: "Two.",
        }),
        buildRow({
          chunkId: "chunk-3",
          content: "Three.",
          hasOversizedParent: true,
          previousChunkId: "chunk-2",
          previousContent: "Two.",
          nextChunkId: "chunk-4",
          nextContent: "Four.",
        }),
        buildRow({
          chunkId: "chunk-4",
          content: "Four.",
          hasOversizedParent: true,
          previousChunkId: "chunk-3",
          previousContent: "Three.",
        }),
      ],
      maxChunkCharacters: 100,
    })

    expect(chunks.map((chunk) => chunk.content)).toEqual(["One.\n\nTwo.", "Three.", "Four."])
  })

  it("leaves a passage without a section alone, even when the row carries neighbours", () => {
    const [chunk] = toRetrievedChunks({
      rows: [buildRow({ previousChunkId: "chunk-0", previousContent: "Passage before." })],
      maxChunkCharacters: 100,
    })

    expect(chunk?.content).toBe("Matching passage.")
  })

  it("cuts a passage that is larger than the limit by itself", () => {
    const [chunk] = toRetrievedChunks({
      rows: [buildRow({ content: "a".repeat(500) })],
      maxChunkCharacters: 120,
    })

    expect(chunk?.content).toHaveLength(120)
  })
})
