import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { EvaluationConversationDataset } from "./evaluation-conversation-dataset.entity"

@Injectable()
export class EvaluationConversationDatasetRepository {
  constructor(private readonly transactionService: TransactionService) {}

  createDataset(
    connectScope: RequiredConnectScope,
    name: string,
  ): Promise<EvaluationConversationDataset> {
    return this.connectRepo().createAndSave(connectScope, { name })
  }

  findOne(
    connectScope: RequiredConnectScope,
    id: string,
  ): Promise<EvaluationConversationDataset | null> {
    return this.connectRepo().getOneById(connectScope, id)
  }

  private connectRepo(): ConnectRepository<EvaluationConversationDataset> {
    return new ConnectRepository(this.repo(), "evaluationConversationDataset")
  }

  private repo(): Repository<EvaluationConversationDataset> {
    return this.transactionService.getManager().getRepository(EvaluationConversationDataset)
  }
}
