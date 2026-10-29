import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
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

/**
 * Unified membership table: one row per role a person holds on a resource (ADR 0032).
 *
 * Unique-index strategy:
 *  - One row per (userId, resourceType, resourceId, roleId) on organizations, projects, agents
 *    and review campaigns: a person can hold several roles on one resource, each role once.
 *  - One row per (userId, roleId) for global assignments, whose resource id is NULL.
 *
 * NOTE: We deliberately do NOT extend Base4AllEntity here to avoid a PK constraint name
 * collision.  The historical "user_membership" table (later renamed to "organization_membership"
 * by migration 1774269635228) left its auto-generated PK constraint
 * `PK_79d3d7350ae33ad6fe1743df86c` in the database.  TypeORM would re-compute the same name
 * for this new entity because the hash is derived from the table + column names.  By using an
 * explicit `primaryKeyConstraintName` here we get a distinct, stable name.
 */
@Entity("user_membership")
@Index("UQ_user_membership_role", ["userId", "resourceType", "resourceId", "roleId"], {
  unique: true,
  where: `"resource_type" <> 'global'`,
})
@Index("UQ_user_membership_global", ["userId", "roleId"], {
  unique: true,
  where: `"resource_type" = 'global'`,
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

  @Column({ type: "uuid", name: "role_id" })
  roleId!: string

  @ManyToOne(() => Role, { nullable: false })
  @JoinColumn({ name: "role_id" })
  rbacRole!: Relation<Role>

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>
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
