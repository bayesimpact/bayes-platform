import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { OAuthGrant } from "./oauth-grant.entity"

/** Opaque refresh token, stored hashed and rotated at each use. */
@Entity("oauth_refresh_token")
@Index("UQ_oauth_refresh_token_hash", ["tokenHash"], { unique: true })
export class OAuthRefreshToken extends Base4AllEntity {
  @Column({ type: "varchar", name: "token_hash" })
  tokenHash!: string

  @Column({ type: "uuid", name: "oauth_grant_id" })
  oauthGrantId!: string

  @ManyToOne(() => OAuthGrant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "oauth_grant_id" })
  oauthGrant!: Relation<OAuthGrant>

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date

  /** Set when the token is exchanged. Seeing it again means it leaked. */
  @Column({ type: "timestamptz", name: "used_at", nullable: true })
  usedAt!: Date | null
}
