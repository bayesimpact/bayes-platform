import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"

export type LegacyWebCrawlDocumentRef = {
  id: string
  organizationId: string
  projectId: string
}

export type LegacyWebCrawlDocument = LegacyWebCrawlDocumentRef & {
  title: string
  sourceUrl: string | null
  /** JSON array of the crawled pages, `[{ url, markdown }]`, or null when the crawl never ended. */
  content: string | null
}

/**
 * TypeORM's raw query returns the rows for SELECT, but a [rows, affectedCount] pair for UPDATE
 * and DELETE.
 */
function affectedRows(result: unknown): number {
  if (Array.isArray(result) && result.length === 2 && typeof result[1] === "number") {
    return result[1]
  }
  return Array.isArray(result) ? result.length : 0
}

/**
 * The legacy web crawls: documents of `source_type = 'webCrawl'`, one per crawled site, read across
 * every organization. Removed with the job that migrates them.
 */
@Injectable()
export class LegacyWebCrawlDocumentRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async countRemaining(): Promise<{ documentCount: number; projectCount: number }> {
    const rows: { documentCount: string; projectCount: string }[] = await this.transactionService
      .getManager()
      .query(
        `SELECT COUNT(*) AS "documentCount", COUNT(DISTINCT project_id) AS "projectCount"
         FROM "document"
         WHERE source_type = 'webCrawl' AND deleted_at IS NULL`,
      )
    return {
      documentCount: Number(rows[0]?.documentCount ?? 0),
      projectCount: Number(rows[0]?.projectCount ?? 0),
    }
  }

  listRemaining(): Promise<LegacyWebCrawlDocumentRef[]> {
    return this.transactionService.getManager().query(
      `SELECT id, organization_id AS "organizationId", project_id AS "projectId"
       FROM "document"
       WHERE source_type = 'webCrawl' AND deleted_at IS NULL
       ORDER BY created_at ASC`,
    )
  }

  async findRemaining(id: string): Promise<LegacyWebCrawlDocument | null> {
    const rows: LegacyWebCrawlDocument[] = await this.transactionService.getManager().query(
      `SELECT id, organization_id AS "organizationId", project_id AS "projectId", title,
              source_url AS "sourceUrl", content
       FROM "document"
       WHERE id = $1 AND source_type = 'webCrawl' AND deleted_at IS NULL`,
      [id],
    )
    return rows[0] ?? null
  }

  /**
   * Removes the document from the `sources` tool calls of the project's messages, the citations a
   * conversation shows under an answer. A `sources` call left with no source is removed whole.
   * Returns how many messages changed.
   */
  async removeFromMessageSources({
    projectId,
    documentId,
  }: {
    projectId: string
    documentId: string
  }): Promise<number> {
    const result: unknown = await this.transactionService.getManager().query(
      `UPDATE "agent_message" AS message
       SET tool_calls = COALESCE((
         SELECT jsonb_agg(rewritten.tool_call ORDER BY rewritten.position)
         FROM (
           SELECT calls.position,
             CASE WHEN calls.tool_call->>'name' = 'sources'
               THEN jsonb_set(calls.tool_call, '{arguments,sources}', COALESCE((
                 SELECT jsonb_agg(sources.source ORDER BY sources.position)
                 FROM jsonb_array_elements(calls.tool_call->'arguments'->'sources')
                   WITH ORDINALITY AS sources(source, position)
                 WHERE sources.source->>'documentId' IS DISTINCT FROM $2
               ), '[]'::jsonb))
               ELSE calls.tool_call
             END AS tool_call
           FROM jsonb_array_elements(message.tool_calls) WITH ORDINALITY AS calls(tool_call, position)
         ) AS rewritten
         WHERE NOT (
           rewritten.tool_call->>'name' = 'sources'
           AND jsonb_array_length(rewritten.tool_call->'arguments'->'sources') = 0
         )
       ), '[]'::jsonb)
       WHERE message.project_id = $1 AND message.tool_calls @> $3::jsonb`,
      [
        projectId,
        documentId,
        JSON.stringify([{ name: "sources", arguments: { sources: [{ documentId }] } }]),
      ],
    )
    return affectedRows(result)
  }

  /**
   * Gives the source the tags of the legacy document. Its page documents inherit them when an agent
   * retrieves by tag. Tags the source already has are kept.
   */
  async copyTagsToSource({
    documentId,
    documentSourceId,
  }: {
    documentId: string
    documentSourceId: string
  }): Promise<void> {
    await this.transactionService.getManager().query(
      `INSERT INTO "document_source_document_tag" (document_source_id, document_tag_id)
       SELECT $2, document_tag_id FROM "document_document_tag" WHERE document_id = $1
       ON CONFLICT DO NOTHING`,
      [documentId, documentSourceId],
    )
  }

  /** Hard-deletes the chunks of the document. Their embeddings go with them (cascade). */
  async deleteChunks(documentId: string): Promise<void> {
    const manager = this.transactionService.getManager()
    await manager.query(`DELETE FROM "document_chunk" WHERE document_id = $1`, [documentId])
    await manager.query(`DELETE FROM "document_parent_chunk" WHERE document_id = $1`, [documentId])
  }
}
