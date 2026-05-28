import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { Agent } from "../agent.entity"

@Entity("agent_sub_agent")
@Unique(["parentAgentId", "childAgentId"])
@Unique(["parentAgentId", "toolName"])
export class AgentSubAgent extends Base4AllEntity {
  @Column({ type: "uuid", name: "parent_agent_id" })
  parentAgentId!: string

  @Column({ type: "uuid", name: "child_agent_id" })
  childAgentId!: string

  @Column({ type: "varchar", name: "tool_name", length: 64 })
  toolName!: string

  @Column({ type: "text", default: "" })
  description!: string

  @Column({ type: "boolean", default: true })
  enabled!: boolean

  @ManyToOne(
    () => Agent,
    (agent) => agent.childSubAgents,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "parent_agent_id" })
  parentAgent!: Agent

  @ManyToOne(
    () => Agent,
    (agent) => agent.parentSubAgents,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "child_agent_id" })
  childAgent!: Agent
}
