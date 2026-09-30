import { Injectable } from "@nestjs/common"
import { toSql } from "pgvector"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"

export type ChunkToEmbed = {
  id: string
  organizationId: string
  projectId: string
  embedText: string
}

export type ChunkEmbeddingRow = {
  organizationId: string
  projectId: string
  chunkId: string
  modelName: string
  embedding: number[]
}

/**
 * Chunks of a project that retrieval can serve: the ones of a live document that finished
 * embedding and belongs to a source retrieval reads from (see DocumentChunkRetrievalService).
 */
const ELIGIBLE_CHUNKS_SQL = `
  FROM document_chunk chunk
  INNER JOIN document ON document.id = chunk.document_id
  WHERE chunk.project_id = $1
    AND chunk.deleted_at IS NULL
    AND document.deleted_at IS NULL
    AND document.embedding_status = 'completed'
    AND document.source_type IN ('project', 'webCrawl')
`

const MISSING_EMBEDDING_SQL = `
  AND NOT EXISTS (
    SELECT 1 FROM document_chunk_embedding embedding
    WHERE embedding.document_chunk_id = chunk.id
      AND embedding.model_name = $2
      AND embedding.deleted_at IS NULL
  )
`

/**
 * Raw SQL on purpose: TypeORM has no pgvector column type, so the `embedding` column is written
 * through pgvector's `toSql()` like the rest of the chunk pipeline.
 */
@Injectable()
export class DocumentChunkEmbeddingRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async countEligibleChunks(projectId: string): Promise<number> {
    const rows: { count: string }[] = await this.query(
      `SELECT COUNT(*)::text AS count ${ELIGIBLE_CHUNKS_SQL}`,
      [projectId],
    )
    return Number(rows[0]?.count ?? 0)
  }

  async countChunksMissingEmbedding({
    projectId,
    modelName,
  }: {
    projectId: string
    modelName: string
  }): Promise<number> {
    const rows: { count: string }[] = await this.query(
      `SELECT COUNT(*)::text AS count ${ELIGIBLE_CHUNKS_SQL} ${MISSING_EMBEDDING_SQL}`,
      [projectId, modelName],
    )
    return Number(rows[0]?.count ?? 0)
  }

  async findChunksMissingEmbedding({
    projectId,
    modelName,
    limit,
  }: {
    projectId: string
    modelName: string
    limit: number
  }): Promise<ChunkToEmbed[]> {
    const rows: {
      id: string
      organization_id: string
      project_id: string
      embed_text: string
    }[] = await this.query(
      `SELECT chunk.id, chunk.organization_id, chunk.project_id, chunk.embed_text
       ${ELIGIBLE_CHUNKS_SQL} ${MISSING_EMBEDDING_SQL}
       ORDER BY chunk.id
       LIMIT $3`,
      [projectId, modelName, limit],
    )
    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      embedText: row.embed_text,
    }))
  }

  /**
   * Inserts one embedding row per chunk, skipping the (chunk, model) pairs that already exist so
   * the re-embedding job and a concurrent document job never collide. Returns the inserted count.
   */
  async insertEmbeddingsIgnoringConflicts(rows: ChunkEmbeddingRow[]): Promise<number> {
    if (rows.length === 0) return 0
    // One statement per batch: on a GPU the model outruns per-row round trips to Postgres.
    const valuesSql = rows
      .map((_row, index) => {
        const offset = index * 5
        return `(uuid_generate_v4(), now(), now(), $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::vector)`
      })
      .join(", ")
    const parameters = rows.flatMap((row) => [
      row.organizationId,
      row.projectId,
      row.chunkId,
      row.modelName,
      toSql(row.embedding),
    ])
    const result: unknown[] = await this.query(
      `INSERT INTO document_chunk_embedding (id, created_at, updated_at, organization_id, project_id, document_chunk_id, model_name, embedding)
       VALUES ${valuesSql}
       ON CONFLICT (document_chunk_id, model_name) DO NOTHING
       RETURNING id`,
      parameters,
    )
    return result.length
  }

  private query<T = unknown>(sql: string, parameters: unknown[]): Promise<T[]> {
    return this.transactionService.getManager().query(sql, parameters) as Promise<T[]>
  }
}
