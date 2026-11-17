import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { EvaluationConversationRunRecord } from "./evaluation-conversation-run-record.entity"

type RunRecordResult = Pick<
  EvaluationConversationRunRecord,
  "output" | "formState" | "score" | "errorDetails" | "traceId"
> & { status: "graded" | "error" }

@Injectable()
export class EvaluationConversationRunRecordRepository {
  constructor(private readonly transactionService: TransactionService) {}

  findForProcessing(connectScope: RequiredConnectScope, id: string) {
    return this.connectRepo().getOneById(connectScope, id)
  }

  /** A cancellation that happened during the LLM call must win over its result. */
  async finishIfRunning(
    connectScope: RequiredConnectScope,
    id: string,
    result: RunRecordResult,
  ): Promise<void> {
    await this.connectRepo().updateManyBy({
      connectScope,
      where: { id, status: "running" },
      // JSONB contains plain JSON, not TypeORM's nested update expressions.
      fields: result as QueryDeepPartialEntity<EvaluationConversationRunRecord>,
    })
  }

  async resetForRetry(connectScope: RequiredConnectScope, ids: string[]): Promise<void> {
    await this.connectRepo().updateManyBy({
      connectScope,
      where: { id: In(ids) },
      fields: {
        status: "running",
        output: null,
        formState: null,
        score: null,
        errorDetails: null,
        traceId: null,
      },
    })
  }

  private connectRepo(): ConnectRepository<EvaluationConversationRunRecord> {
    return new ConnectRepository(
      this.transactionService.getManager().getRepository(EvaluationConversationRunRecord),
      "evaluationConversationRunRecord",
    )
  }
}
