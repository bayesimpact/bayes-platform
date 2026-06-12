import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm"
import { RolePermission } from "./role-permission.entity"

@Entity("permission")
@Unique("UQ_permission_action_subject", ["action", "subject"])
export class Permission {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ type: "varchar" })
  action!: string

  @Column({ type: "varchar" })
  subject!: string

  @Column({ type: "text", nullable: true })
  description!: string | null

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.permission,
  )
  rolePermissions!: RolePermission[]
}
