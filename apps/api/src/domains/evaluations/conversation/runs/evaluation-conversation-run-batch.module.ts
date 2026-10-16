import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { BullMqEvaluationConversationRunBatchService } from "./bull-mq-evaluation-conversation-run-batch.service"
import {
  EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME,
  EVALUATION_CONVERSATION_RUN_QUEUE_NAME,
} from "./evaluation-conversation-run.constants"
import { EVALUATION_CONVERSATION_RUN_BATCH_SERVICE } from "./evaluation-conversation-run-batch.interface"

@Module({
  imports: [
    BullModule.registerQueue({ name: EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME }),
    BullModule.registerQueue({ name: EVALUATION_CONVERSATION_RUN_QUEUE_NAME }),
  ],
  providers: [
    BullMqEvaluationConversationRunBatchService,
    {
      provide: EVALUATION_CONVERSATION_RUN_BATCH_SERVICE,
      useExisting: BullMqEvaluationConversationRunBatchService,
    },
  ],
  exports: [EVALUATION_CONVERSATION_RUN_BATCH_SERVICE],
})
export class EvaluationConversationRunBatchModule {}
