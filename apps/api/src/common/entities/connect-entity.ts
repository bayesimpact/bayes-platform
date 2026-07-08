import { Column, Entity, Index, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"

export abstract class ConnectEntityBase extends Base4AllEntity {
  @Column({ type: "uuid", name: "organization_id", nullable: false })
  organizationId!: string
  @Column({ type: "uuid", name: "project_id", nullable: false })
  projectId!: string
}

export function ConnectEntity(entityName: string, ...extendedPrimaryIndexFields: string[]) {
  return <T extends abstract new (...args: unknown[]) => object>(target: T): void => {
    Entity(entityName)(target)
    Index(["organizationId", "projectId", ...extendedPrimaryIndexFields])(target)
  }
}
export function ConnectEntityWithUniqueIndex(
  entityName: string,
  ...extendedUniqueIndexFields: string[]
) {
  return <T extends abstract new (...args: unknown[]) => object>(target: T): void => {
    Entity(entityName)(target)
    Unique(["organizationId", "projectId", ...extendedUniqueIndexFields])(target)
  }
}
