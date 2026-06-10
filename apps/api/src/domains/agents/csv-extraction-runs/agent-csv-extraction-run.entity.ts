import { Column, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import type { Agent } from "@/domains/agents/agent.entity"
import type { Document } from "@/domains/documents/document.entity"
import { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"

export const AGENT_CSV_EXTRACTION_RUN_COLUMN_ROLES = ["input", "reference", "ignore"] as const
export type AgentCsvExtractionRunColumnRole = (typeof AGENT_CSV_EXTRACTION_RUN_COLUMN_ROLES)[number]

export type AgentCsvExtractionRunColumnSchemaEntry = {
  id: string
  originalName: string
  finalName: string
  role: AgentCsvExtractionRunColumnRole
  index: number
}

export type AgentCsvExtractionRunColumnSchema = Record<
  string,
  AgentCsvExtractionRunColumnSchemaEntry
>

export const AGENT_CSV_EXTRACTION_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const
export type AgentCsvExtractionRunStatus = (typeof AGENT_CSV_EXTRACTION_RUN_STATUSES)[number]

export type AgentCsvExtractionRunSummary = {
  total: number
  processed: number
  errors: number
  running: number
}

@ConnectEntity("agent_csv_extraction_run")
export class AgentCsvExtractionRun extends ConnectEntityBase {
  @Column({ type: "uuid", name: "agent_id", nullable: false })
  agentId!: string
  @ManyToOne("Agent", (agent: Agent) => agent.id)
  @JoinColumn({ name: "agent_id" })
  agent!: Agent

  @Column({ type: "uuid", name: "csv_document_id", nullable: false })
  csvDocumentId!: string
  @ManyToOne("Document", (document: Document) => document.id)
  @JoinColumn({ name: "csv_document_id" })
  csvDocument!: Document

  @Column({ name: "column_schema", type: "jsonb", nullable: false })
  columnSchema!: AgentCsvExtractionRunColumnSchema

  @Column({ type: "varchar", default: "pending" })
  status!: AgentCsvExtractionRunStatus

  @Column({ name: "summary", type: "jsonb", nullable: true })
  summary!: AgentCsvExtractionRunSummary | null

  @OneToMany(
    () => AgentCsvExtractionRunRecord,
    (record) => record.agentCsvExtractionRun,
  )
  records!: AgentCsvExtractionRunRecord[]

  @Column({ type: "uuid", name: "csv_export_document_id", nullable: true })
  csvExportDocumentId!: string | null
  @ManyToOne("Document", (document: Document) => document.id, { nullable: true })
  @JoinColumn({ name: "csv_export_document_id" })
  csvExportDocument!: Document | null
}
