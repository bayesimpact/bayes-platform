import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity } from "@/common/entities/connect-entity"
import { DocumentEntityBase } from "@/common/entities/document-entity-base"
import { Organization } from "@/domains/organizations/organization.entity"
import { Project } from "@/domains/projects/project.entity"

@ConnectEntity("agent_message_attachment_document", "createdAt")
export class AgentMessageAttachmentDocument extends DocumentEntityBase {
  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: "organization_id" })
  organization!: Organization

  @ManyToOne(() => Project, { nullable: false })
  @JoinColumn({ name: "project_id" })
  project!: Project

  /** Rendered PNG page count in GCS (derived/{id}/page-{n}.png); null = not rendered. PDFs only. */
  @Column({ type: "integer", name: "pdf_page_count", nullable: true })
  pdfPageCount!: number | null
}
