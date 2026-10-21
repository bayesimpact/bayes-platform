import { Column, JoinColumn, ManyToOne, OneToMany, type Relation } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { Document } from "@/domains/documents/document.entity"
import { User } from "@/domains/users/user.entity"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
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
  @Column({ type: "uuid", name: "agent_settings_id", nullable: false })
  agentSettingsId!: string
  @ManyToOne("AgentSettings", (agentSettings: AgentSettings) => agentSettings.id, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agent_settings_id" })
  agentSettings!: AgentSettings

  @Column({ type: "uuid", name: "csv_document_id", nullable: false })
  csvDocumentId!: string
  @ManyToOne("Document", (document: Document) => document.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "csv_document_id" })
  csvDocument!: Relation<Document>

  @Column({ name: "column_schema", type: "jsonb", nullable: false })
  columnSchema!: AgentCsvExtractionRunColumnSchema

  // Rows predating the column are backfilled from the CSV uploader's agent membership (agent
  // "member" → live, everyone else → playground). The default matches that fallback and must
  // stay in sync with the DB default from migration AddTypeToAgentCsvExtractionRun.
  @Column({ type: "varchar", default: "playground" })
  type!: BaseAgentSessionType

  // Rows predating the column are backfilled from the CSV document's uploader. Kept nullable as
  // a safety net: null rows stay listed for every project member rather than vanishing (see
  // AgentCsvExtractionRunsService.listRuns).
  @Column({ type: "uuid", name: "user_id", nullable: true })
  userId!: string | null
  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User | null

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
