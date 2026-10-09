import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { AppInstallation } from "./app-installation.entity"

@Entity("app_install_authorization_code")
@Index("UQ_app_install_authorization_code_hash", ["codeHash"], { unique: true })
export class AppInstallAuthorizationCode extends Base4AllEntity {
  @Column({ type: "varchar", name: "code_hash" })
  codeHash!: string

  @Column({ type: "uuid", name: "app_installation_id" })
  appInstallationId!: string

  @ManyToOne(() => AppInstallation)
  @JoinColumn({ name: "app_installation_id" })
  appInstallation!: AppInstallation

  @Column({ type: "uuid", name: "client_id" })
  clientId!: string

  /** Plaintext secret until the one-time exchange; cleared when consumed. */
  @Column({ type: "varchar", name: "client_secret", nullable: true })
  clientSecret!: string | null

  @Column({ type: "varchar", name: "redirect_uri" })
  redirectUri!: string

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date

  @Column({ type: "timestamptz", name: "consumed_at", nullable: true })
  consumedAt!: Date | null
}
