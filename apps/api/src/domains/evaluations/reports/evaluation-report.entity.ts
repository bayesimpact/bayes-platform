import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { Evaluation } from "../evaluation.entity"

@ConnectEntity("evaluation_report")
export class EvaluationReport extends ConnectEntityBase {
  @Column({ type: "uuid", name: "evaluation_id", nullable: false })
  evaluationId!: string
  @ManyToOne(
    () => Evaluation,
    (evaluation) => evaluation.reports,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "evaluation_id" })
  evaluation!: Evaluation

  @Column({ type: "uuid", name: "agent_id", nullable: false })
  agentId!: string
  @ManyToOne(
    () => Agent,
    (agent) => agent.evaluationReports,
  )
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  @Column({ type: "uuid", name: "agent_settings_id", nullable: false })
  agentSettingsId!: string
  @ManyToOne("AgentSettings", (agentSettings: AgentSettings) => agentSettings.id, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_settings_id" })
  agentSettings!: AgentSettings

  @Column({ type: "uuid", name: "trace_id", nullable: false })
  traceId!: string

  @Column({ name: "output", nullable: false })
  output!: string

  @Column({ name: "score", nullable: false })
  score!: string
}
