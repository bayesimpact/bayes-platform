import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { OAuthGrant } from "./oauth-grant.entity"

/** Single-use code of the authorization code flow, stored hashed. */
@Entity("oauth_authorization_code")
@Index("UQ_oauth_authorization_code_hash", ["codeHash"], { unique: true })
export class OAuthAuthorizationCode extends Base4AllEntity {
  @Column({ type: "varchar", name: "code_hash" })
  codeHash!: string

  @Column({ type: "uuid", name: "oauth_grant_id" })
  oauthGrantId!: string

  @ManyToOne(() => OAuthGrant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "oauth_grant_id" })
  oauthGrant!: Relation<OAuthGrant>

  @Column({ type: "varchar", name: "redirect_uri", length: 2048 })
  redirectUri!: string

  /** RFC 7636 S256 challenge. */
  @Column({ type: "varchar", name: "code_challenge" })
  codeChallenge!: string

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date

  @Column({ type: "timestamptz", name: "consumed_at", nullable: true })
  consumedAt!: Date | null
}
