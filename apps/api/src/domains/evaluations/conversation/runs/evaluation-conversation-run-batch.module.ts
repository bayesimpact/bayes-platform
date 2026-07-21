import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { BullBoardModule } from "@bull-board/nestjs"
import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { isBullBoardEnabled } from "@/common/bull-board/bull-board-env"
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
    ...(isBullBoardEnabled()
      ? [
          BullBoardModule.forFeature({
            name: EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME,
            adapter: BullMQAdapter,
          }),
          BullBoardModule.forFeature({
            name: EVALUATION_CONVERSATION_RUN_QUEUE_NAME,
            adapter: BullMQAdapter,
          }),
        ]
      : []),
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
