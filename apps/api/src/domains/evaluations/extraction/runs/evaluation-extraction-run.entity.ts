import { Column, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Document } from "@/domains/documents/document.entity"
import { EvaluationExtractionDataset } from "../datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionRunRecord } from "./records/evaluation-extraction-run-record.entity"

export type EvaluationExtractionRunKeyMappingEntry = {
  agentOutputKey: string
  datasetColumnId: string
  mode: "scored" | "fyi"
}
export type EvaluationExtractionRunKeyMapping = EvaluationExtractionRunKeyMappingEntry[]

export const EVALUATION_EXTRACTION_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const
export type EvaluationExtractionRunStatus = (typeof EVALUATION_EXTRACTION_RUN_STATUSES)[number]

export type EvaluationExtractionRunSummary = {
  total: number
  perfectMatches: number
  mismatches: number
  errors: number
  running: number
}

@ConnectEntity("evaluation_extraction_run")
export class EvaluationExtractionRun extends ConnectEntityBase {
  @Column({ type: "uuid", name: "evaluation_extraction_dataset_id", nullable: false })
  evaluationExtractionDatasetId!: string
  @ManyToOne(
    () => EvaluationExtractionDataset,
    (evaluationExtractionDataset: EvaluationExtractionDataset) => evaluationExtractionDataset.id,
  )
  @JoinColumn({ name: "evaluation_extraction_dataset_id" })
  evaluationExtractionDataset!: EvaluationExtractionDataset

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

  @Column({ name: "key_mapping", type: "jsonb", nullable: false })
  keyMapping!: EvaluationExtractionRunKeyMapping

  @Column({ type: "varchar", default: "pending" })
  status!: EvaluationExtractionRunStatus

  @Column({ name: "summary", type: "jsonb", nullable: true })
  summary!: EvaluationExtractionRunSummary | null

  @OneToMany(
    () => EvaluationExtractionRunRecord,
    (record) => record.evaluationExtractionRun,
  )
  records!: EvaluationExtractionRunRecord[]

  @Column({ type: "uuid", name: "csv_export_document_id", nullable: true })
  csvExportDocumentId!: string | null
  @ManyToOne("Document", (document: Document) => document.id, { nullable: true })
  @JoinColumn({ name: "csv_export_document_id" })
  csvExportDocument!: Document | null
}
