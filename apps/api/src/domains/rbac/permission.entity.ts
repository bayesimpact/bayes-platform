import { Column, Entity } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"

@Entity("permission")
export class Permission extends Base4AllEntity {
  @Column({ type: "varchar", unique: true })
  key!: string
}
