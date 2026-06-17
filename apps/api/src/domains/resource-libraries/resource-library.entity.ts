import type { ResourceDto } from "@caseai-connect/api-contracts"
import { Column, ManyToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import type { Agent } from "@/domains/agents/agent.entity"

@ConnectEntity("resource_library")
export class ResourceLibrary extends ConnectEntityBase {
  @Column({ type: "varchar" })
  title!: string

  @Column({ type: "jsonb", default: () => "'[]'" })
  resources!: ResourceDto[]

  @ManyToMany("Agent", (agent: Agent) => agent.resourceLibraries)
  agents!: Agent[]
}
