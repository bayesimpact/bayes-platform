import { Column, Entity, OneToMany } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { RolePermission } from "./role-permission.entity"

@Entity("role")
export class Role extends Base4AllEntity {
  @Column({ type: "varchar", unique: true })
  name!: string

  @Column({ type: "text", nullable: true })
  description!: string | null

  @Column({ type: "boolean", name: "is_system", default: false })
  isSystem!: boolean

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.role,
  )
  rolePermissions!: RolePermission[]
}
