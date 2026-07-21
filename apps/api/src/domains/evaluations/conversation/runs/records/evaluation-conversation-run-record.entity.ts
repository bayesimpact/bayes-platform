import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { EvaluationConversationDatasetRecord } from "../../datasets/records/evaluation-conversation-dataset-record.entity"
import { EvaluationConversationRun } from "../evaluation-conversation-run.entity"

export const EVALUATION_CONVERSATION_RUN_RECORD_STATUSES = [
  "graded",
  "error",
  "running",
  "cancelled",
] as const
export type EvaluationConversationRunRecordStatus =
  (typeof EVALUATION_CONVERSATION_RUN_RECORD_STATUSES)[number]

@ConnectEntity("evaluation_conversation_run_record", "evaluationConversationRunId", "status")
export class EvaluationConversationRunRecord extends ConnectEntityBase {
  @Column({ type: "uuid", name: "evaluation_conversation_run_id", nullable: false })
  evaluationConversationRunId!: string
  @ManyToOne(
    () => EvaluationConversationRun,
    (evaluationConversationRun) => evaluationConversationRun.records,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "evaluation_conversation_run_id" })
  evaluationConversationRun!: EvaluationConversationRun

  // Nullable: deleting a dataset record keeps historical run records alive (the run
  // record snapshots input/expectedOutput below) and simply detaches the link.
  @Column({ type: "uuid", name: "evaluation_conversation_dataset_record_id", nullable: true })
  evaluationConversationDatasetRecordId!: string | null
  @ManyToOne(
    () => EvaluationConversationDatasetRecord,
    (evaluationConversationDatasetRecord) => evaluationConversationDatasetRecord.id,
    { onDelete: "SET NULL", nullable: true },
  )
  @JoinColumn({ name: "evaluation_conversation_dataset_record_id" })
  evaluationConversationDatasetRecord!: EvaluationConversationDatasetRecord | null

  @Column({ type: "varchar", default: "running" })
  status!: EvaluationConversationRunRecordStatus

  // Snapshot copies of the dataset record taken at fan-out time, so a run stays
  // consistent even if the dataset record is later edited or deleted.
  @Column({ name: "input", type: "text", nullable: false })
  input!: string

  @Column({ name: "expected_output", type: "text", nullable: false })
  expectedOutput!: string

  @Column({ name: "output", type: "text", nullable: true })
  output!: string | null

  @Column({ name: "score", type: "int", nullable: true })
  score!: number | null

  @Column({ name: "error_details", type: "text", nullable: true })
  errorDetails!: string | null

  @Column({ name: "trace_id", type: "varchar", nullable: true })
  traceId!: string | null
}
