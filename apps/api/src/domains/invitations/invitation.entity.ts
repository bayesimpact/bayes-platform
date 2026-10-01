import { Column, Entity, Index } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import type { InvitationStatus, InvitationTargetType } from "./invitation.types"

@Entity("invitation")
@Index(["userId", "status"])
@Index(["targetType", "targetId", "status"])
export class Invitation extends Base4AllEntity {
  @Column({ type: "uuid", name: "organization_id" })
  organizationId!: string

  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @Column({ type: "varchar", name: "target_type" })
  targetType!: InvitationTargetType

  @Column({ type: "uuid", name: "target_id" })
  targetId!: string

  /** The invited account. An unknown email gets an account that has never signed in. */
  @Column({ type: "uuid", name: "user_id", nullable: true })
  userId!: string | null

  @Column({ type: "varchar", name: "invited_email", nullable: true })
  invitedEmail!: string | null

  /** Legacy Auth0 ticket id. New invitations store a random value: acceptance goes through the invitation id. */
  @Column({ type: "varchar", name: "invitation_token", unique: true })
  invitationToken!: string

  @Column({ type: "varchar" })
  status!: InvitationStatus

  @Column({ type: "varchar" })
  role!: string

  @Column({ type: "timestamp", name: "invited_at" })
  invitedAt!: Date

  @Column({ type: "timestamp", name: "accepted_at", nullable: true })
  acceptedAt!: Date | null
}
