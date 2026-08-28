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

  // handoff mode only. When true (default), a classifier watches this sub-agent's own
  // messages and force-clears activeAgentId back to the parent if one reads as a
  // conclusion even though the sub-agent never called concludeHandoff itself — a safety
  // net for sub-agents that have a natural finishing point but sometimes forget to signal
  // it explicitly. Set to false for a sub-agent with no natural "done" point (e.g. an
  // open-ended Q&A agent that is the last step of a workflow), where a single unhelpful
  // reply ("I don't have that information") should never be misread as the whole task
  // being over and force a handback to the parent.
  @Column({ type: "boolean", name: "force_conclusion_enabled", default: true })
  forceConclusionEnabled!: boolean

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
