import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm"
import { Permission } from "./permission.entity"
import { Role } from "./role.entity"

@Entity("role_permission")
export class RolePermission {
  @PrimaryColumn({ type: "uuid", name: "role_id" })
  roleId!: string

  @PrimaryColumn({ type: "uuid", name: "permission_id" })
  permissionId!: string

  @ManyToOne(() => Role, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role!: Role

  @ManyToOne(() => Permission, { onDelete: "CASCADE" })
  @JoinColumn({ name: "permission_id" })
  permission!: Permission
}
