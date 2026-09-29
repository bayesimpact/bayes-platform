import { Column } from "typeorm"
import { ConnectEntity } from "@/common/entities/connect-entity"
import { DocumentEntityBase } from "@/common/entities/document-entity-base"

export type EvaluationExtractionDatasetDocumentUploadStatus = "pending" | "uploaded"

/**
 * A CSV file uploaded to build evaluation extraction datasets from. It is stored
 * in the same bucket as project documents but lives in its own table: it is never
 * embedded, tagged or exposed to chat, and a dataset points at the file it was
 * built from through `EvaluationExtractionDataset.evaluationExtractionDatasetDocumentId`.
 */
@ConnectEntity("evaluation_extraction_dataset_document")
export class EvaluationExtractionDatasetDocument extends DocumentEntityBase {
  /** `pending` between presign and confirm: the row exists but the file may not be in storage yet. */
  @Column({ type: "varchar", name: "upload_status", default: "pending" })
  uploadStatus!: EvaluationExtractionDatasetDocumentUploadStatus
}
