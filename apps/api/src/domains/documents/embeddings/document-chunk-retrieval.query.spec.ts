import { randomUUID } from "node:crypto"
import { EmbeddingModel } from "@caseai-connect/api-contracts"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import type { Document } from "@/domains/documents/document.entity"
import { createOrganizationWithDocument } from "@/domains/organizations/organization.factory"
import { DocumentChunkRetrievalService } from "./document-chunk-retrieval.service"

const MAX_CHUNK_CHARACTERS = 200
const MODEL_NAME = EmbeddingModel.GeminiEmbedding001

/**
 * Runs the real retrieval query on Postgres. The query-builder mocks of the service spec cannot
 * see which text a hit carries.
 */
describe("DocumentChunkRetrievalService query", () => {
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let service: DocumentChunkRetrievalService
  let document: Document
  const previousMaxChunkCharacters = process.env.DOCUMENT_RETRIEVAL_MAX_CHUNK_CHARS

  const connectScope = () => ({
    organizationId: document.organizationId,
    projectId: document.projectId,
  })

  const insertParent = async (content: string): Promise<string> => {
    const parentId = randomUUID()
    await setup.dataSource.query(
      `INSERT INTO document_parent_chunk (id, organization_id, project_id, document_id, content, embed_text, chunk_index)
       VALUES ($1, $2, $3, $4, $5, $5, 0)`,
      [parentId, document.organizationId, document.projectId, document.id, content],
    )
    return parentId
  }

  /** Inserts the passages of one section in order, linked to each other, the first one closest to the query. */
  const insertChildren = async ({
    parentId,
    contents,
  }: {
    parentId: string | null
    contents: string[]
  }): Promise<string[]> => {
    const childIds = contents.map(() => randomUUID())
    for (const [index, content] of contents.entries()) {
      await setup.dataSource.query(
        `INSERT INTO document_chunk (id, organization_id, project_id, document_id, content, embed_text, chunk_index, parent_id, prev_chunk_id, next_chunk_id)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9)`,
        [
          childIds[index],
          document.organizationId,
          document.projectId,
          document.id,
          content,
          index,
          parentId,
          childIds[index - 1] ?? null,
          childIds[index + 1] ?? null,
        ],
      )
      await setup.dataSource.query(
        `INSERT INTO document_chunk_embedding (id, organization_id, project_id, document_chunk_id, model_name, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [
          randomUUID(),
          document.organizationId,
          document.projectId,
          childIds[index],
          MODEL_NAME,
          `[1,${index}]`,
        ],
      )
    }
    return childIds
  }

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase()
    service = new DocumentChunkRetrievalService(
      setup.dataSource,
      { listCompletedModelNames: jest.fn().mockResolvedValue([MODEL_NAME]) } as never,
      { embedQuery: jest.fn().mockResolvedValue([1, 0]) } as never,
    )
  })

  beforeEach(async () => {
    process.env.DOCUMENT_RETRIEVAL_MAX_CHUNK_CHARS = String(MAX_CHUNK_CHARACTERS)
    await clearTestDatabase(setup.dataSource)
    ;({ document } = await createOrganizationWithDocument(setup.getAllRepositories(), {
      document: { embeddingStatus: "completed" },
    }))
  })

  afterAll(async () => {
    if (previousMaxChunkCharacters === undefined) {
      delete process.env.DOCUMENT_RETRIEVAL_MAX_CHUNK_CHARS
    } else {
      process.env.DOCUMENT_RETRIEVAL_MAX_CHUNK_CHARS = previousMaxChunkCharacters
    }
    await teardownTestDatabase(setup)
  })

  it("returns the section once, under its own id, when it fits the limit", async () => {
    const parentId = await insertParent("Section title. First passage. Second passage.")
    await insertChildren({ parentId, contents: ["First passage.", "Second passage."] })

    const chunks = await service.retrieveTopChunks({ connectScope: connectScope(), query: "q" })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({
      chunkId: parentId,
      content: "Section title. First passage. Second passage.",
      chunkIndex: 0,
      isParentChunk: true,
    })
  })

  it("returns the best passage with its neighbour when the section is over the limit", async () => {
    const parentId = await insertParent("a".repeat(MAX_CHUNK_CHARACTERS + 1))
    const [firstId] = await insertChildren({
      parentId,
      contents: ["First passage.", "Second passage.", "Third passage."],
    })

    const chunks = await service.retrieveTopChunks({
      connectScope: connectScope(),
      query: "q",
      topK: 1,
    })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({
      chunkId: firstId,
      content: "First passage.\n\nSecond passage.",
      chunkIndex: 0,
      isParentChunk: false,
    })
  })

  it("returns several passages of an oversized section without repeating a passage", async () => {
    const parentId = await insertParent("a".repeat(MAX_CHUNK_CHARACTERS + 1))
    const [firstId, secondId] = await insertChildren({
      parentId,
      contents: ["First passage.", "Second passage.", "Third passage."],
    })

    const chunks = await service.retrieveTopChunks({
      connectScope: connectScope(),
      query: "q",
      topK: 2,
    })

    expect(chunks.map((chunk) => ({ chunkId: chunk.chunkId, content: chunk.content }))).toEqual([
      { chunkId: firstId, content: "First passage." },
      { chunkId: secondId, content: "Second passage.\n\nThird passage." },
    ])
  })

  it("cuts a passage without a section that is over the limit", async () => {
    await insertChildren({ parentId: null, contents: ["b".repeat(MAX_CHUNK_CHARACTERS * 3)] })

    const chunks = await service.retrieveTopChunks({ connectScope: connectScope(), query: "q" })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.content).toHaveLength(MAX_CHUNK_CHARACTERS)
    expect(chunks[0]?.isParentChunk).toBe(false)
  })
})
