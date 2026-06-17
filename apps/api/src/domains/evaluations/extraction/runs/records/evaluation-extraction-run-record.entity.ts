import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { EvaluationExtractionDatasetRecord } from "../../datasets/records/evaluation-extraction-dataset-record.entity"
import { EvaluationExtractionRun } from "../evaluation-extraction-run.entity"

export type EvaluationExtractionRunRecordFieldStatus = "match" | "mismatch" | "fyi"

export type EvaluationExtractionRunRecordFieldResult = {
  agentValue: unknown
  groundTruth: unknown
  status: EvaluationExtractionRunRecordFieldStatus
}

export type EvaluationExtractionRunRecordComparison = Record<
  string,
  EvaluationExtractionRunRecordFieldResult
>

export const EVALUATION_EXTRACTION_RUN_RECORD_STATUSES = [
  "match",
  "mismatch",
  "error",
  "running",
  "cancelled",
] as const
export type EvaluationExtractionRunRecordStatus =
  (typeof EVALUATION_EXTRACTION_RUN_RECORD_STATUSES)[number]

@ConnectEntity("evaluation_extraction_run_record", "evaluationExtractionRunId", "status")
export class EvaluationExtractionRunRecord extends ConnectEntityBase {
  @Column({ type: "uuid", name: "evaluation_extraction_run_id", nullable: false })
  evaluationExtractionRunId!: string
  @ManyToOne(
    () => EvaluationExtractionRun,
    (evaluationExtractionRun) => evaluationExtractionRun.records,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "evaluation_extraction_run_id" })
  evaluationExtractionRun!: EvaluationExtractionRun

  @Column({ type: "uuid", name: "evaluation_extraction_dataset_record_id", nullable: false })
  evaluationExtractionDatasetRecordId!: string
  @ManyToOne(
    () => EvaluationExtractionDatasetRecord,
    (evaluationExtractionDatasetRecord) => evaluationExtractionDatasetRecord.id,
  )
  @JoinColumn({ name: "evaluation_extraction_dataset_record_id" })
  evaluationExtractionDatasetRecord!: EvaluationExtractionDatasetRecord

  @Column({ type: "varchar", default: "match" })
  status!: EvaluationExtractionRunRecordStatus

  @Column({ name: "comparison", type: "jsonb", nullable: true })
  comparison!: EvaluationExtractionRunRecordComparison | null

  @Column({ name: "agent_raw_output", type: "jsonb", nullable: true })
  agentRawOutput!: Record<string, unknown> | null

  @Column({ name: "error_details", type: "text", nullable: true })
  errorDetails!: string | null

  @Column({ name: "trace_id", type: "varchar", nullable: true })
  traceId!: string | null
}
