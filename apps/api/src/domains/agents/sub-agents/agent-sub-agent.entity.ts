import type { AgentSubAgentMode } from "@caseai-connect/api-contracts"
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

  // "relay" (default): the parent proxies every exchange via a tool call. "handoff": the end
  // user talks directly to this sub-agent's own session until it hands back control. See
  // AgentSubAgentMode in api-contracts.
  @Column({ type: "varchar", default: "relay" })
  mode!: AgentSubAgentMode

  // Handoff-mode only. When set, the platform activates this child directly the moment this
  // link's round concludes, bypassing the parent agent's own routing judgment entirely. Null
  // (default) preserves today's behavior: control returns to the parent agent to decide.
  @Column({ type: "uuid", name: "next_child_agent_id", nullable: true })
  nextChildAgentId!: string | null

  @ManyToOne(() => Agent, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "next_child_agent_id" })
  nextChildAgent?: Agent | null

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
