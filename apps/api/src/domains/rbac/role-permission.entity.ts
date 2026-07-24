import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm"
import { Role } from "./role.entity"

@Entity("role_permission")
export class RolePermission {
  @PrimaryColumn({ type: "uuid", name: "role_id" })
  roleId!: string

  @PrimaryColumn({ type: "varchar", name: "permission_key" })
  permissionKey!: string

  @ManyToOne(() => Role, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role!: Role
}
