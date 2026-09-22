import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { AppManifest } from "./app-manifest.entity"

export const APP_INSTALLATION_STATUS_ACTIVE = "active" as const
export const APP_INSTALLATION_STATUS_REVOKED = "revoked" as const

export type AppInstallationStatus =
  | typeof APP_INSTALLATION_STATUS_ACTIVE
  | typeof APP_INSTALLATION_STATUS_REVOKED

@Entity("app_installation")
@Index("IDX_app_installation_manifest_status", ["appManifestId", "status"])
export class AppInstallation extends Base4AllEntity {
  @Column({ type: "uuid", name: "app_manifest_id" })
  appManifestId!: string

  @ManyToOne(() => AppManifest)
  @JoinColumn({ name: "app_manifest_id" })
  appManifest!: AppManifest

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @Column({ type: "varchar", default: APP_INSTALLATION_STATUS_ACTIVE })
  status!: AppInstallationStatus
}
