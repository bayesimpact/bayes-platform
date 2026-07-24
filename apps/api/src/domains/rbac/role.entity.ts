import { Column, Entity } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import type { RoleScopeType } from "./rbac.constants"

@Entity("role")
export class Role extends Base4AllEntity {
  @Column({ type: "varchar", unique: true })
  key!: string

  @Column({ type: "varchar" })
  name!: string

  @Column({ type: "varchar", name: "scope_type" })
  scopeType!: RoleScopeType
}
