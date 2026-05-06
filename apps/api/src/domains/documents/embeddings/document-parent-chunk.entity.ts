import { Column } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"

@ConnectEntity("document_parent_chunk")
export class DocumentParentChunk extends ConnectEntityBase {
  @Column({ name: "document_id", type: "uuid" })
  documentId!: string

  @Column({ name: "content", type: "text" })
  content!: string

  @Column({ name: "embed_text", type: "text" })
  embedText!: string

  @Column({ name: "chunk_index", type: "integer" })
  chunkIndex!: number

  @Column({ name: "prev_chunk_id", type: "uuid", nullable: true })
  prevChunkId!: string | null

  @Column({ name: "next_chunk_id", type: "uuid", nullable: true })
  nextChunkId!: string | null

  @Column({ name: "headings", type: "jsonb", default: [] })
  headings!: string[]

  @Column({ name: "captions", type: "jsonb", default: [] })
  captions!: string[]
}
