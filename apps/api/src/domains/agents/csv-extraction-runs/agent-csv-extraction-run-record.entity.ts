import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"

export const AGENT_CSV_EXTRACTION_RUN_RECORD_STATUSES = ["running", "success", "error"] as const
export type AgentCsvExtractionRunRecordStatus =
  (typeof AGENT_CSV_EXTRACTION_RUN_RECORD_STATUSES)[number]

@ConnectEntity("agent_csv_extraction_run_record", "agentCsvExtractionRunId", "status")
export class AgentCsvExtractionRunRecord extends ConnectEntityBase {
  @Column({ type: "uuid", name: "agent_csv_extraction_run_id", nullable: false })
  agentCsvExtractionRunId!: string
  @ManyToOne(
    () => AgentCsvExtractionRun,
    (run) => run.records,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "agent_csv_extraction_run_id" })
  agentCsvExtractionRun!: AgentCsvExtractionRun

  @Column({ type: "int", name: "row_index", nullable: false })
  rowIndex!: number

  @Column({ name: "input_data", type: "jsonb", nullable: true })
  inputData!: Record<string, unknown> | null

  @Column({ name: "agent_raw_output", type: "jsonb", nullable: true })
  agentRawOutput!: Record<string, unknown> | null

  @Column({ type: "varchar", default: "running" })
  status!: AgentCsvExtractionRunRecordStatus

  @Column({ name: "error_details", type: "text", nullable: true })
  errorDetails!: string | null

  @Column({ name: "trace_id", type: "varchar", nullable: true })
  traceId!: string | null
}
