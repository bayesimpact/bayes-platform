import type { AgentModel } from "@caseai-connect/api-contracts"
import { Column, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { EvaluationConversationDataset } from "../datasets/evaluation-conversation-dataset.entity"
import { EvaluationConversationRunRecord } from "./records/evaluation-conversation-run-record.entity"

export const EVALUATION_CONVERSATION_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const
export type EvaluationConversationRunStatus = (typeof EVALUATION_CONVERSATION_RUN_STATUSES)[number]

export type EvaluationConversationRunSummary = {
  averageScore: number | null
  errors: number
  graded: number
  running: number
  total: number
}

@ConnectEntity("evaluation_conversation_run")
export class EvaluationConversationRun extends ConnectEntityBase {
  @Column({ type: "uuid", name: "evaluation_conversation_dataset_id", nullable: false })
  evaluationConversationDatasetId!: string
  @ManyToOne(
    () => EvaluationConversationDataset,
    (evaluationConversationDataset: EvaluationConversationDataset) =>
      evaluationConversationDataset.id,
  )
  @JoinColumn({ name: "evaluation_conversation_dataset_id" })
  evaluationConversationDataset!: EvaluationConversationDataset

  @Column({ type: "uuid", name: "agent_id", nullable: false })
  agentId!: string
  @ManyToOne("Agent", (agent: Agent) => agent.id)
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  @Column({ type: "uuid", name: "agent_settings_id", nullable: false })
  agentSettingsId!: string
  @ManyToOne("AgentSettings", (agentSettings: AgentSettings) => agentSettings.id, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_settings_id" })
  agentSettings!: AgentSettings

  @Column({ type: "varchar", default: "pending" })
  status!: EvaluationConversationRunStatus

  @Column({ type: "varchar", name: "judge_model", default: "gemini-2.5-flash" })
  judgeModel!: AgentModel

  // Optional extra instructions injected into the judge's grading prompt.
  @Column({ type: "text", name: "judge_instructions", nullable: true })
  judgeInstructions!: string | null

  @Column({ name: "summary", type: "jsonb", nullable: true })
  summary!: EvaluationConversationRunSummary | null

  @OneToMany(
    () => EvaluationConversationRunRecord,
    (record) => record.evaluationConversationRun,
  )
  records!: EvaluationConversationRunRecord[]
}
