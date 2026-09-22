import { Column, Entity, Index } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"

@Entity("app_manifest")
@Index(["slug"], { unique: true, where: '"deleted_at" IS NULL' })
export class AppManifest extends Base4AllEntity {
  @Column({ type: "varchar" })
  name!: string

  @Column({ type: "varchar" })
  slug!: string

  @Column({ type: "varchar", nullable: true })
  description!: string | null

  @Column({ type: "varchar", name: "logo_url", nullable: true })
  logoUrl!: string | null

  @Column({ type: "jsonb", name: "grantable_permissions", default: [] })
  grantablePermissions!: string[]
}
