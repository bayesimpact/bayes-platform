import { Column, Index, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { DocumentChunk } from "./document-chunk.entity"

// Note: the `embedding vector` column is created by migration but intentionally
// omitted here. TypeORM does not support the pgvector type natively; insertions with
// the embedding value are performed via raw SQL using pgvector's toSql() helper.
@Index("IDX_document_chunk_embedding_chunk_model", ["documentChunkId", "modelName"], {
  unique: true,
})
@ConnectEntity("document_chunk_embedding")
export class DocumentChunkEmbedding extends ConnectEntityBase {
  @ManyToOne(() => DocumentChunk, { onDelete: "CASCADE" })
  @JoinColumn({ name: "document_chunk_id" })
  documentChunk!: DocumentChunk

  @Column({ name: "document_chunk_id", type: "uuid" })
  documentChunkId!: string

  @Column({ name: "model_name", type: "varchar" })
  modelName!: string

  // Untyped on purpose: each model_name stores its own dimension (gemini 3072, bge-m3 1024). Retrieval always filters on model_name, so a distance never mixes sizes.
  @Column({ name: "embedding", type: "vector", nullable: true })
  ___dont_use_this_column_directly___!: number[]
}
