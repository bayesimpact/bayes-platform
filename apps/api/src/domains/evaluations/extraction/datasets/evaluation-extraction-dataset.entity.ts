import { Column, JoinColumn, ManyToOne, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { EvaluationExtractionDatasetDocument } from "./evaluation-extraction-dataset-document.entity"
import { EvaluationExtractionDatasetRecord } from "./records/evaluation-extraction-dataset-record.entity"

export const COLUMN_ROLES = ["target", "input", "reference", "ignore"] as const
export type ColumnRole = (typeof COLUMN_ROLES)[number]
export type DatasetSchemaColumn = {
  finalName: string
  id: string
  index: number
  originalName: string
  role: ColumnRole
}
export type EvaluationExtractionDatasetSchemaMapping = Record<
  DatasetSchemaColumn["id"],
  DatasetSchemaColumn
>

@ConnectEntity("evaluation_extraction_dataset")
export class EvaluationExtractionDataset extends ConnectEntityBase {
  @Column({ name: "name", nullable: false })
  name!: string

  @Column({ name: "schema_mapping", nullable: false, type: "jsonb" })
  schemaMapping!: EvaluationExtractionDatasetSchemaMapping

  @OneToMany(
    () => EvaluationExtractionDatasetRecord,
    (record) => record.evaluationExtractionDataset,
  )
  records!: EvaluationExtractionDatasetRecord[]

  /** The uploaded CSV the records were built from. Null until the dataset is initialized. */
  @Column({ type: "uuid", name: "evaluation_extraction_dataset_document_id", nullable: true })
  evaluationExtractionDatasetDocumentId!: string | null
  @ManyToOne(() => EvaluationExtractionDatasetDocument, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "evaluation_extraction_dataset_document_id" })
  evaluationExtractionDatasetDocument!: EvaluationExtractionDatasetDocument | null
}
