import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm"
import { Role } from "@/domains/rbac/role.entity"
import { User } from "@/domains/users/user.entity"

export type UserMembershipResourceType =
  | "organization"
  | "project"
  | "agent"
  | "review_campaign"
  | "global"

/** All roles that can appear in the unified membership table. */
export type UserMembershipRole = "owner" | "admin" | "member" | "tester" | "reviewer"

/**
 * Unified membership table consolidating organization_membership, project_membership,
 * agent_membership, and review_campaign_membership.
 *
 * Unique-index strategy:
 *  - One row per (userId, resourceId, resourceType) for organization/project/agent
 *    (a user holds exactly one role per resource).
 *  - One row per (userId, resourceId, resourceType, role) for review_campaign
 *    (a user can simultaneously hold both "tester" and "reviewer" roles on the same campaign).
 *
 * NOTE: We deliberately do NOT extend Base4AllEntity here to avoid a PK constraint name
 * collision.  The historical "user_membership" table (later renamed to "organization_membership"
 * by migration 1774269635228) left its auto-generated PK constraint
 * `PK_79d3d7350ae33ad6fe1743df86c` in the database.  TypeORM would re-compute the same name
 * for this new entity because the hash is derived from the table + column names.  By using an
 * explicit `primaryKeyConstraintName` here we get a distinct, stable name.
 */
@Entity("user_membership")
@Index("UQ_user_membership_non_campaign", ["userId", "resourceId", "resourceType"], {
  unique: true,
  where: `"resource_type" <> 'review_campaign'`,
})
@Index("UQ_user_membership_campaign", ["userId", "resourceId", "resourceType", "role"], {
  unique: true,
  where: `"resource_type" = 'review_campaign'`,
})
export class UserMembership {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_user_membership_id" })
  id!: string

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date

  @DeleteDateColumn({ name: "deleted_at", nullable: true })
  deletedAt!: Date | null

  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @Column({ type: "varchar", name: "resource_type" })
  resourceType!: UserMembershipResourceType

  @Column({ type: "uuid", name: "resource_id", nullable: true })
  resourceId!: string | null

  /** Legacy role column for backward compatibility with the old user_membership table. */
  @Column({ type: "varchar" })
  role!: UserMembershipRole

  @Column({ type: "uuid", name: "role_id", nullable: true })
  roleId!: string | null

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: "role_id" })
  rbacRole!: Role | null

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User
}

/** Resource id for scoped memberships; global rows have no resource. */
export function getMembershipResourceId(membership: UserMembership): string {
  if (membership.resourceId === null) {
    throw new Error(
      `Membership ${membership.id} with resource_type=${membership.resourceType} is missing resource_id`,
    )
  }

  return membership.resourceId
}
