import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Project } from "../projects/project.entity"

@Entity({ name: "feature_flag" })
@Index("feature_flag_UNIQUE", ["featureFlagKey", "projectId"], {
  unique: true,
})
export class FeatureFlag extends Base4AllEntity {
  @Column({ type: "uuid", name: "project_id", nullable: false })
  projectId!: string
  @ManyToOne(
    () => Project,
    (project) => project.featureFlags,
  )
  @JoinColumn({ name: "project_id" })
  project!: Relation<Project>

  @Column({ name: "enabled", default: true, nullable: false })
  enabled!: boolean

  @Column({ name: "feature_flag_key", nullable: false })
  featureFlagKey!: string
}
