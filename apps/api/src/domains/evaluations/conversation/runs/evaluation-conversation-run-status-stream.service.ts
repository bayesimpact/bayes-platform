import type { EvaluationConversationRunStatusChangedEventDto } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { PostgresStatusStreamService } from "@/common/sse/postgres-status-stream.service"
import { EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL } from "./evaluation-conversation-run.constants"

@Injectable()
export class EvaluationConversationRunStatusStreamService extends PostgresStatusStreamService<EvaluationConversationRunStatusChangedEventDto> {
  constructor() {
    super({
      channel: EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL,
      expectedType: EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL,
      serviceName: EvaluationConversationRunStatusStreamService.name,
      isExpectedEvent: (payload) =>
        payload.type === EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL,
    })
  }
}
