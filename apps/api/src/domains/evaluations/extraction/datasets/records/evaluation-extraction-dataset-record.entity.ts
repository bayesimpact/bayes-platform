import { Column, JoinColumn, ManyToOne, type Relation } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { EvaluationExtractionDataset } from "../evaluation-extraction-dataset.entity"

export type EvaluationExtractionDatasetRecordData = {
  [columnId: string]: unknown
}

@ConnectEntity("evaluation_extraction_dataset_record")
export class EvaluationExtractionDatasetRecord extends ConnectEntityBase {
  @Column({ type: "uuid", name: "evaluation_extraction_dataset_id", nullable: false })
  evaluationExtractionDatasetId!: string
  @ManyToOne(
    () => EvaluationExtractionDataset,
    (evaluationExtractionDataset) => evaluationExtractionDataset.records,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "evaluation_extraction_dataset_id" })
  evaluationExtractionDataset!: Relation<EvaluationExtractionDataset>

  @Column({ name: "data", nullable: false, type: "jsonb" })
  data!: EvaluationExtractionDatasetRecordData
}
