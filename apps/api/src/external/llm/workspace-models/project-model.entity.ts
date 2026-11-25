import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Project } from "@/domains/projects/project.entity"

/**
 * Whether a workspace offers a model of the code. A model without a row follows the default of
 * the code (`isModelEnabledByDefault`). Rows are deleted for good, never soft-deleted.
 */
@Entity({ name: "project_model" })
@Index("project_model_project_model_UNIQUE", ["projectId", "model"], { unique: true })
export class ProjectModel extends Base4AllEntity {
  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Relation<Project>

  /** An `AgentModel` value. */
  @Column({ type: "varchar", name: "model" })
  model!: string

  @Column({ type: "boolean", name: "enabled" })
  enabled!: boolean
}
