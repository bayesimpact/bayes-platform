import type {
  EvaluationConversationRunStatusDto,
  EvaluationConversationRunSummaryDto,
} from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { PostgresStatusNotifierService } from "@/common/sse/postgres-status-notifier.service"
import { EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL } from "./evaluation-conversation-run.constants"

@Injectable()
export class EvaluationConversationRunStatusNotifierService extends PostgresStatusNotifierService {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL)
  }

  async notifyRunStatusChanged(params: {
    evaluationConversationRunId: string
    organizationId: string
    projectId: string
    status: EvaluationConversationRunStatusDto
    summary: EvaluationConversationRunSummaryDto | null
    updatedAt: number
  }): Promise<void> {
    await this.notify({
      type: EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL,
      evaluationConversationRunId: params.evaluationConversationRunId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      status: params.status,
      summary: params.summary,
      updatedAt: params.updatedAt,
    })
  }
}
