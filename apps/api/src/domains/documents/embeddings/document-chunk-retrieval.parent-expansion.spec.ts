import { randomUUID } from "node:crypto"
import { embed } from "ai"
import { toSql } from "pgvector"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { DocumentChunkRetrievalService } from "./document-chunk-retrieval.service"

jest.mock("ai", () => ({
  ...jest.requireActual("ai"),
  embed: jest.fn(),
}))

/**
 * Reproduction for #588 — "small-to-big" retrieval.
 *
 * Documents are chunked at two levels. The small **child** chunk is what gets
 * embedded, because a short passage matches a question precisely. The larger
 * **parent** chunk is the surrounding passage the child was cut from.
 *
 * The point of the design is that retrieval matches on the child but hands the
 * LLM the *parent* text, so the model reads a whole coherent passage instead of
 * one orphaned sentence.
 *
 * The defect: `buildDedupedChunksQuery` selects `content` and `chunkIndex`
 * twice each — once parent-aware as `COALESCE(parent.…, chunk.…)`, and again as
 * plain `chunk.…`. Postgres allows duplicate output aliases, and node-postgres
 * keeps the LAST one when building the row object.
 *
 * TypeORM does not emit the selects in the order they were added: it hoists
 * plain column references ahead of raw expressions. The generated list is
 *
 *   chunk.content AS content,
 *   COALESCE(parent.id, chunk.id) AS chunkId,
 *   COALESCE(parent.chunk_index, chunk.chunk_index) AS chunkIndex,
 *   COALESCE(parent.content, chunk.content) AS content,
 *   chunk.chunk_index AS chunkIndex
 *
 * so the winner differs per field: `content` lands on the parent-aware select
 * and is correct **by accident**, while `chunkIndex` lands on the plain one and
 * reports the child's position for a row labelled as the parent.
 *
 * Both facts are pinned below. The `content` test guards against the severe
 * version of this bug: any reordering of the `addSelect` calls, or a TypeORM
 * upgrade that changes select ordering, silently flips it to the child text.
 *
 * These tests run against the real database on purpose — the bug is in the SQL
 * projection, so the sibling spec's mocked query builder cannot see it. Only the
 * embedding call is stubbed.
 */

const EMBEDDING_MODEL = "gemini-embedding-001"
const EMBEDDING_DIMENSIONS = 3072

const PARENT_PASSAGE =
  "Annual leave accrues at two days per month from the start date. " +
  "Unused days may be carried over into the first quarter of the following year. " +
  "After that quarter closes, any remaining days expire and are not paid out."

const CHILD_SENTENCE =
  "Unused days may be carried over into the first quarter of the following year."

/** Any fixed vector works: the stubbed query embedding is identical, so distance is 0. */
const storedVector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1)

describe("DocumentChunkRetrievalService — parent chunk expansion (#588)", () => {
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: ReturnType<
    Awaited<ReturnType<typeof setupTransactionalTestDatabase>>["getAllRepositories"]
  >
  let service: DocumentChunkRetrievalService
  let organizationId: string
  let projectId: string

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({})
    repositories = setup.getAllRepositories()
    service = new DocumentChunkRetrievalService(setup.dataSource)
  })

  beforeEach(async () => {
    await deleteChunkTables()
    await clearTestDatabase(setup.dataSource)

    process.env.GOOGLE_VERTEX_PROJECT = "test-project"
    process.env.GOOGLE_VERTEX_LOCATION = "us-central1"
    process.env.DOCUMENT_EMBEDDING_MODELS = EMBEDDING_MODEL
    ;(embed as jest.MockedFunction<typeof embed>).mockResolvedValue({
      embedding: storedVector,
    } as never)

    const { organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
  })

  afterAll(async () => {
    await deleteChunkTables()
    await teardownTestDatabase(setup)
  })

  /** These three tables are not covered by clearTestDatabase and have no cascade from `document`. */
  const deleteChunkTables = async () => {
    await setup.dataSource.query(`DELETE FROM "document_chunk_embedding"`)
    await setup.dataSource.query(`DELETE FROM "document_chunk"`)
    await setup.dataSource.query(`DELETE FROM "document_parent_chunk"`)
  }

  /**
   * One embedded document holding a single parent passage and one child sentence
   * cut from it. The embedding is attached to the child, as in production.
   */
  const givenADocumentChunkedIntoAParentAndOneChild = async () => {
    const document = await repositories.documentRepository.save(
      repositories.documentRepository.create({
        organizationId,
        projectId,
        title: "Leave policy",
        fileName: "leave-policy.pdf",
        mimeType: "application/pdf",
        sourceType: "project",
        embeddingStatus: "completed",
      }),
    )

    const parentChunkId = randomUUID()
    await setup.dataSource.query(
      `INSERT INTO "document_parent_chunk"
         (id, created_at, updated_at, organization_id, project_id, document_id, content, embed_text, chunk_index, headings, captions)
       VALUES ($1, now(), now(), $2, $3, $4, $5, $5, 0, '[]'::jsonb, '[]'::jsonb)`,
      [parentChunkId, organizationId, projectId, document.id, PARENT_PASSAGE],
    )

    const childChunkId = randomUUID()
    await setup.dataSource.query(
      `INSERT INTO "document_chunk"
         (id, created_at, updated_at, organization_id, project_id, document_id, parent_id, content, embed_text, chunk_index, headings, captions)
       VALUES ($1, now(), now(), $2, $3, $4, $5, $6, $6, 7, '[]'::jsonb, '[]'::jsonb)`,
      [childChunkId, organizationId, projectId, document.id, parentChunkId, CHILD_SENTENCE],
    )

    await setup.dataSource.query(
      `INSERT INTO "document_chunk_embedding"
         (id, created_at, updated_at, organization_id, project_id, document_chunk_id, model_name, embedding)
       VALUES ($1, now(), now(), $2, $3, $4, $5, $6::vector)`,
      [randomUUID(), organizationId, projectId, childChunkId, EMBEDDING_MODEL, toSql(storedVector)],
    )

    return { documentId: document.id, parentChunkId, childChunkId }
  }

  const retrieve = async () =>
    service.retrieveTopChunks({
      connectScope: { organizationId, projectId },
      conversationSummary: "",
      latestUserQuestion: "Can I carry over unused leave?",
      topK: 5,
    })

  it("finds the embedded child chunk", async () => {
    await givenADocumentChunkedIntoAParentAndOneChild()

    const chunks = await retrieve()

    expect(chunks).toHaveLength(1)
  })

  it("reports the hit as a parent chunk, under the parent's id", async () => {
    const { parentChunkId } = await givenADocumentChunkedIntoAParentAndOneChild()

    const [chunk] = await retrieve()

    expect(chunk?.isParentChunk).toBe(true)
    expect(chunk?.chunkId).toBe(parentChunkId)
  })

  it("hands the LLM the whole parent passage, not just the matched sentence", async () => {
    await givenADocumentChunkedIntoAParentAndOneChild()

    const [chunk] = await retrieve()

    // PASSES TODAY — but only because TypeORM happens to order the duplicate
    // `content` selects so the parent-aware one wins. Reordering the addSelect
    // calls, or a TypeORM upgrade, flips this to CHILD_SENTENCE and silently
    // strips the surrounding context from every answer.
    expect(chunk?.content).toBe(PARENT_PASSAGE)
    expect(chunk?.content).not.toBe(CHILD_SENTENCE)
  })

  it("reports the parent's position in the document as chunkIndex", async () => {
    await givenADocumentChunkedIntoAParentAndOneChild()

    const [chunk] = await retrieve()

    // FAILS TODAY — this is the bug. The row is labelled as the parent chunk and
    // carries the parent's id, yet chunkIndex is the child's position: the plain
    // `chunk.chunk_index` select shadows the `COALESCE(parent.chunk_index, …)`
    // one. The parent sits at index 0; the child cut from it sits at index 7.
    expect(chunk?.chunkIndex).toBe(0)
  })
})
