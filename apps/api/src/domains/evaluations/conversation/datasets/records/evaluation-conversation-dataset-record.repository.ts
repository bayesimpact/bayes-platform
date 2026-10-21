import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { EvaluationConversationDatasetRecord } from "./evaluation-conversation-dataset-record.entity"

export type CreateEvaluationConversationDatasetRecordFields = Pick<
  EvaluationConversationDatasetRecord,
  "evaluationConversationDatasetId" | "input" | "expectedOutput" | "comment"
>

@Injectable()
export class EvaluationConversationDatasetRecordRepository {
  constructor(private readonly transactionService: TransactionService) {}

  createRecord(
    connectScope: RequiredConnectScope,
    fields: CreateEvaluationConversationDatasetRecordFields,
  ): Promise<EvaluationConversationDatasetRecord> {
    return this.connectRepo().createAndSave(connectScope, fields)
  }

  private connectRepo(): ConnectRepository<EvaluationConversationDatasetRecord> {
    return new ConnectRepository(this.repo(), "evaluationConversationDatasetRecord")
  }

  private repo(): Repository<EvaluationConversationDatasetRecord> {
    return this.transactionService.getManager().getRepository(EvaluationConversationDatasetRecord)
  }
}
