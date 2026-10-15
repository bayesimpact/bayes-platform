import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  type Relation,
} from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Project } from "@/domains/projects/project.entity"
import { User } from "@/domains/users/user.entity"
import { OAuthClient } from "./oauth-client.entity"

/**
 * What a person allowed a client to do: some permissions on some projects.
 * The client acts as the person, so a right also needs the person to hold it.
 */
@Entity("oauth_grant")
@Index("IDX_oauth_grant_user_id", ["userId"])
export class OAuthGrant extends Base4AllEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>

  @Column({ type: "uuid", name: "oauth_client_id" })
  oauthClientId!: string

  @ManyToOne(() => OAuthClient, { onDelete: "CASCADE" })
  @JoinColumn({ name: "oauth_client_id" })
  oauthClient!: Relation<OAuthClient>

  @ManyToMany(() => Project, { onDelete: "CASCADE" })
  @JoinTable({
    name: "oauth_grant_project",
    joinColumn: { name: "oauth_grant_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "project_id", referencedColumnName: "id" },
  })
  projects!: Project[]

  @Column({ type: "jsonb", name: "permissions" })
  permissions!: string[]

  /** RFC 8707 resource the tokens of this grant are issued for. */
  @Column({ type: "varchar", name: "resource", length: 2048 })
  resource!: string

  @Column({ type: "timestamptz", name: "revoked_at", nullable: true })
  revokedAt!: Date | null

  @Column({ type: "timestamptz", name: "last_used_at", nullable: true })
  lastUsedAt!: Date | null
}
