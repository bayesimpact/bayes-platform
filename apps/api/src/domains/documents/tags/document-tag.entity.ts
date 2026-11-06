import { Column, ManyToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import type { Agent } from "@/domains/agents/agent.entity"
import type { Document } from "../document.entity"
import type { DocumentSource } from "../sources/document-source.entity"

@ConnectEntity("document_tag")
export class DocumentTag extends ConnectEntityBase {
  @Column({ name: "name", nullable: false })
  name!: string

  @Column({ name: "description", type: "text", nullable: true })
  description!: string | null

  @Column({ name: "parent_id", type: "uuid", nullable: true })
  parentId!: string | null

  @ManyToMany("Document", (document: Document) => document.tags)
  documents!: Document[]

  @ManyToMany("DocumentSource", (documentSource: DocumentSource) => documentSource.tags)
  documentSources!: DocumentSource[]

  @ManyToMany("Agent", (agent: Agent) => agent.documentTags)
  agents!: Agent[]
}
