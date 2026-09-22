import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Project } from "@/domains/projects/project.entity"
import { Role } from "@/domains/rbac/role.entity"
import { User } from "@/domains/users/user.entity"
import { AppManifest } from "./app-manifest.entity"

export const APP_INSTALLATION_STATUS_ACTIVE = "active" as const
export const APP_INSTALLATION_STATUS_REVOKED = "revoked" as const

export type AppInstallationStatus =
  | typeof APP_INSTALLATION_STATUS_ACTIVE
  | typeof APP_INSTALLATION_STATUS_REVOKED

@Entity("app_installation")
@Index("IDX_app_installation_manifest_status", ["appManifestId", "status"])
@Index("UQ_app_installation_active_manifest_project", ["appManifestId", "projectId"], {
  unique: true,
  where: `"status" = 'active' AND "deleted_at" IS NULL`,
})
@Index("UQ_app_installation_client_id", ["clientId"], {
  unique: true,
  where: `"client_id" IS NOT NULL`,
})
export class AppInstallation extends Base4AllEntity {
  @Column({ type: "uuid", name: "app_manifest_id" })
  appManifestId!: string

  @ManyToOne(() => AppManifest)
  @JoinColumn({ name: "app_manifest_id" })
  appManifest!: AppManifest

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @ManyToOne(() => Project)
  @JoinColumn({ name: "project_id" })
  project!: Project

  @Column({ type: "uuid", name: "service_user_id", nullable: true })
  serviceUserId!: string | null

  @ManyToOne(() => User)
  @JoinColumn({ name: "service_user_id" })
  serviceUser?: User | null

  @Column({ type: "uuid", name: "custom_role_id", nullable: true })
  customRoleId!: string | null

  @ManyToOne(() => Role)
  @JoinColumn({ name: "custom_role_id" })
  customRole?: Role | null

  @Column({ type: "uuid", name: "client_id", nullable: true })
  clientId!: string | null

  @Column({ type: "varchar", name: "client_secret_hash", nullable: true })
  clientSecretHash!: string | null

  @Column({ type: "varchar", default: APP_INSTALLATION_STATUS_ACTIVE })
  status!: AppInstallationStatus

  @Column({ type: "uuid", name: "created_by_user_id", nullable: true })
  createdByUserId!: string | null

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by_user_id" })
  createdByUser?: User | null

  @Column({ type: "timestamptz", name: "revoked_at", nullable: true })
  revokedAt!: Date | null
}
