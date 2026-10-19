import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { AppManifest } from "@/domains/apps/app-manifest.entity"

/**
 * How the authorization server learned about the client:
 * - cimd: the client id is the URL of a client ID metadata document, fetched by the API
 * - dcr: the client registered itself through dynamic client registration (RFC 7591)
 * - app: the confidential client of an app manifest, created from the back-office (ADR 0029)
 */
export type OAuthClientRegistrationType = "cimd" | "dcr" | "app"

@Entity("oauth_client")
@Index("UQ_oauth_client_client_id", ["clientId"], { unique: true })
@Index("UQ_oauth_client_app_manifest_id", ["appManifestId"], {
  unique: true,
  where: `"app_manifest_id" IS NOT NULL`,
})
export class OAuthClient extends Base4AllEntity {
  /** Public client id: the metadata document URL (cimd) or a generated id (dcr, app). */
  @Column({ type: "varchar", name: "client_id", length: 2048 })
  clientId!: string

  @Column({ type: "varchar", name: "registration_type", length: 8 })
  registrationType!: OAuthClientRegistrationType

  /** Declared by the client, so only trusted for display when the client is cimd. */
  @Column({ type: "varchar", name: "client_name", length: 200, nullable: true })
  clientName!: string | null

  @Column({ type: "jsonb", name: "redirect_uris" })
  redirectUris!: string[]

  /** When the metadata document of a cimd client was last fetched. */
  @Column({ type: "timestamptz", name: "metadata_fetched_at", nullable: true })
  metadataFetchedAt!: Date | null

  /** The app a confidential client stands for. Its name and redirect URIs come from it. */
  @Column({ type: "uuid", name: "app_manifest_id", nullable: true })
  appManifestId!: string | null

  @ManyToOne(() => AppManifest, { onDelete: "CASCADE" })
  @JoinColumn({ name: "app_manifest_id" })
  appManifest?: AppManifest | null

  /** scrypt hash of the secret of a confidential client, never stored in clear. */
  @Column({ type: "varchar", name: "client_secret_hash", nullable: true })
  clientSecretHash!: string | null
}
