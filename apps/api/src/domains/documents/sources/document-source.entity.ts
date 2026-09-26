import { Column, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { Document } from "@/domains/documents/document.entity"
import { Project } from "@/domains/projects/project.entity"

// Declared on the entity so migration:generate emits it and later generates do not drop it.
@Index("document_source_project_external_id_unique", ["projectId", "externalId"], {
  unique: true,
  where: '"external_id" IS NOT NULL',
})
@ConnectEntity("document_source")
export class DocumentSource extends ConnectEntityBase {
  @Column({ name: "name", type: "varchar", nullable: false })
  name!: string

  /** Free string set by the installing app. */
  @Column({ name: "type", type: "varchar", nullable: true })
  type!: string | null

  /** Unique per project when set. Several sources may omit it. */
  @Column({ name: "external_id", type: "varchar", nullable: true })
  externalId!: string | null

  @Column({ name: "base_url", type: "text", nullable: true })
  baseUrl!: string | null

  /** App metadata. Never returned by the app API. Do not store secrets here. */
  @Column({ name: "config", type: "jsonb", nullable: true })
  config!: Record<string, unknown> | null

  @ManyToOne(
    () => Project,
    (project) => project.documentSources,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "project_id" })
  project!: Project

  @OneToMany(
    () => Document,
    (document) => document.documentSource,
  )
  documents!: Document[]
}
