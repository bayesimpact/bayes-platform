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

export type RoleGrantResourceType =
  | "organization"
  | "project"
  | "agent"
  | "review_campaign"
  | "global"

/**
 * One role a person holds on a resource, or a global role with no resource (ADR 0032). A
 * member of a resource is the set of their grants on it, with no row of its own. This table was
 * named `user_membership` until #1147.
 *
 * Unique-index strategy:
 *  - One row per (userId, resourceType, resourceId, roleId) on organizations, projects, agents
 *    and review campaigns: a person can hold several roles on one resource, each role once.
 *  - One row per (userId, roleId) for global assignments, whose resource id is NULL.
 *
 * NOTE: We deliberately do NOT extend Base4AllEntity here to avoid a PK constraint name
 * collision.  An older, historical "user_membership" table (renamed to "organization_membership"
 * by migration 1774269635228) left its auto-generated PK constraint
 * `PK_79d3d7350ae33ad6fe1743df86c` in the database.  An explicit `primaryKeyConstraintName`
 * keeps the name of this table's PK distinct and stable.
 */
@Entity("role_grant")
@Index("UQ_role_grant_role", ["userId", "resourceType", "resourceId", "roleId"], {
  unique: true,
  where: `"resource_type" <> 'global'`,
})
@Index("UQ_role_grant_global", ["userId", "roleId"], {
  unique: true,
  where: `"resource_type" = 'global'`,
})
export class RoleGrant {
  @PrimaryGeneratedColumn("uuid", { primaryKeyConstraintName: "PK_role_grant_id" })
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
  resourceType!: RoleGrantResourceType

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
export function getMembershipResourceId(membership: RoleGrant): string {
  if (membership.resourceId === null) {
    throw new Error(
      `Membership ${membership.id} with resource_type=${membership.resourceType} is missing resource_id`,
    )
  }

  return membership.resourceId
}
