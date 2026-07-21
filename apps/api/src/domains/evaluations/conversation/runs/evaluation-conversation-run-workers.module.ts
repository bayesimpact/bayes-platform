import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { AgentLlmModule } from "@/domains/agents/shared/agent-session-messages/streaming/agent-llm.module"
import { LlmModule } from "@/external/llm/llm.module"
import {
  EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME,
  EVALUATION_CONVERSATION_RUN_QUEUE_NAME,
} from "./evaluation-conversation-run.constants"
import { EvaluationConversationRunWorker } from "./evaluation-conversation-run.worker"
import { EvaluationConversationRunExecuteWorker } from "./evaluation-conversation-run-execute.worker"
import { EvaluationConversationRunGraderService } from "./evaluation-conversation-run-grader.service"
import { EvaluationConversationRunProcessorService } from "./evaluation-conversation-run-processor.service"
import { EvaluationConversationRunStarterService } from "./evaluation-conversation-run-starter.service"
import { EvaluationConversationRunStatusNotifierService } from "./evaluation-conversation-run-status-notifier.service"
import { QueueMetricsService } from "./queue-metrics.service"

@Module({
  imports: [
    BullModule.registerQueue({ name: EVALUATION_CONVERSATION_RUN_EXECUTE_QUEUE_NAME }),
    BullModule.registerQueue({ name: EVALUATION_CONVERSATION_RUN_QUEUE_NAME }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    LlmModule,
    AgentLlmModule,
  ],
  providers: [
    EvaluationConversationRunExecuteWorker,
    EvaluationConversationRunStarterService,
    EvaluationConversationRunWorker,
    EvaluationConversationRunProcessorService,
    EvaluationConversationRunStatusNotifierService,
    EvaluationConversationRunGraderService,
    QueueMetricsService,
  ],
})
export class EvaluationConversationRunWorkersModule {}
