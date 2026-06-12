import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Permission } from "./permission.entity"
import { Role } from "./role.entity"

@Entity("role_permission")
@Index("IDX_role_permission_role", ["roleId"])
@Index("IDX_role_permission_permission", ["permissionId"])
export class RolePermission extends Base4AllEntity {
  @Column({ type: "uuid", name: "role_id" })
  roleId!: string

  @Column({ type: "uuid", name: "permission_id" })
  permissionId!: string

  /**
   * Optional permission-level constraints (e.g. `{ status: "active" }`).
   * Scope constraints live on `UserRole.conditions` instead — this column is
   * reserved for rules that apply to every grant of the role.
   */
  @Column({ type: "jsonb", nullable: true })
  conditions!: Record<string, unknown> | null

  /** Column-level restriction. Null means all fields. */
  @Column({ type: "text", array: true, nullable: true })
  fields!: string[] | null

  /** True = CASL `cannot` rule. */
  @Column({ type: "boolean", default: false })
  inverted!: boolean

  @Column({ type: "text", nullable: true })
  reason!: string | null

  @ManyToOne(
    () => Role,
    (role) => role.rolePermissions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "role_id" })
  role!: Role

  @ManyToOne(
    () => Permission,
    (permission) => permission.rolePermissions,
    { onDelete: "RESTRICT" },
  )
  @JoinColumn({ name: "permission_id" })
  permission!: Permission
}
