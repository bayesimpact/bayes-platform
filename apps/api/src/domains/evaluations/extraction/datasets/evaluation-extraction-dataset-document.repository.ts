import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { EvaluationExtractionDatasetDocument } from "./evaluation-extraction-dataset-document.entity"

export type CreateEvaluationExtractionDatasetDocumentFields = Pick<
  EvaluationExtractionDatasetDocument,
  "id" | "fileName" | "mimeType" | "size" | "storageRelativePath"
>

@Injectable()
export class EvaluationExtractionDatasetDocumentRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /** Creates the row in `pending` state: the file is confirmed once it has been uploaded to storage. */
  createPending(
    connectScope: RequiredConnectScope,
    fields: CreateEvaluationExtractionDatasetDocumentFields,
  ): Promise<EvaluationExtractionDatasetDocument> {
    return this.connectRepo().createAndSave(connectScope, { ...fields, uploadStatus: "pending" })
  }

  async markAsUploaded(connectScope: RequiredConnectScope, id: string): Promise<boolean> {
    const affected = await this.connectRepo().updateManyBy({
      connectScope,
      where: { id },
      fields: { uploadStatus: "uploaded" },
    })
    return affected === 1
  }

  findOne(
    connectScope: RequiredConnectScope,
    id: string,
  ): Promise<EvaluationExtractionDatasetDocument | null> {
    return this.connectRepo().getOneById(connectScope, id)
  }

  /** Uploaded files only, newest first. Pending rows are uploads that never got confirmed. */
  async listUploaded(
    connectScope: RequiredConnectScope,
  ): Promise<EvaluationExtractionDatasetDocument[]> {
    return this.connectRepo().find(connectScope, {
      where: { uploadStatus: "uploaded" },
      order: { createdAt: "DESC" },
    })
  }

  /** Hard delete. Datasets built from the file keep their records and lose the reference. */
  deleteOne(connectScope: RequiredConnectScope, id: string): Promise<boolean> {
    return this.connectRepo().deleteOneById({ connectScope, id, softDelete: false })
  }

  private connectRepo(): ConnectRepository<EvaluationExtractionDatasetDocument> {
    return new ConnectRepository(this.repo(), "evaluationExtractionDatasetDocument")
  }

  private repo(): Repository<EvaluationExtractionDatasetDocument> {
    return this.transactionService.getManager().getRepository(EvaluationExtractionDatasetDocument)
  }
}
