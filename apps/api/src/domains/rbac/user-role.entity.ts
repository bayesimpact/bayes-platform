import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { User } from "@/domains/users/user.entity"
import { Role } from "./role.entity"

/**
 * A user's grant of a role, optionally scoped via `conditions`.
 *
 * `conditions` carries ABAC scope filters resolved against the request at policy
 * evaluation time (e.g. `{ organizationId, projectId }`). A user gets distinct
 * rows for "admin of org A" vs "member of org B".
 */
@Entity("user_role")
@Index("IDX_user_role_user", ["userId"])
@Index("IDX_user_role_role", ["roleId"])
export class UserRole extends Base4AllEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @Column({ type: "uuid", name: "role_id" })
  roleId!: string

  @Column({ type: "jsonb", nullable: true })
  conditions!: Record<string, unknown> | null

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User

  @ManyToOne(() => Role, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role!: Role
}
