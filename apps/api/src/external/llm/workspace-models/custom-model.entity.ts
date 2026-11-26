import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Project } from "@/domains/projects/project.entity"

/**
 * A model a workspace added next to the models of the code: a self-hosted model of the code
 * (`baseModel`, whose options and behaviour apply) on a server of its own. Agents pick it as one
 * more line of their model list. The URL and key are read only by the backoffice and the LLM
 * providers, never sent to the apps. Rows are deleted for good, and only while no agent revision
 * uses them (`agent_settings.custom_model_id` restricts it).
 */
@Entity({ name: "custom_model" })
@Index("custom_model_project_id_IDX", ["projectId"])
export class CustomModel extends Base4AllEntity {
  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @ManyToOne(() => Project, { onDelete: "CASCADE" })
  @JoinColumn({ name: "project_id" })
  project!: Relation<Project>

  @Column({ type: "varchar", name: "name" })
  name!: string

  /** An `AgentModel` value of a self-hosted provider. */
  @Column({ type: "varchar", name: "base_model" })
  baseModel!: string

  @Column({ type: "varchar", name: "base_url" })
  baseUrl!: string

  /**
   * Encrypted with `EncryptionService`. Null sends no key, or the key of the environment variables
   * when the server is the one of the environment.
   */
  @Column({ type: "text", name: "api_key_encrypted", nullable: true })
  apiKeyEncrypted!: string | null

  /** The name the server knows the model by. Null asks for the id of `baseModel`. */
  @Column({ type: "varchar", name: "served_model_name", nullable: true })
  servedModelName!: string | null
}
