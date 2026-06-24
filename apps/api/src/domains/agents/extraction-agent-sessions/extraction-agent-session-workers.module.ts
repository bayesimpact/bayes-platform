import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { LlmModule } from "@/external/llm/llm.module"
import { EXTRACTION_AGENT_SESSION_QUEUE_NAME } from "./extraction-agent-session.constants"
import { ExtractionAgentSessionExecuteWorker } from "./extraction-agent-session-execute.worker"
import { ExtractionAgentSessionRunnerService } from "./extraction-agent-session-runner.service"
import { ExtractionAgentSessionStatusNotifierService } from "./extraction-agent-session-status-notifier.service"
import { ExtractionAgentSessionQueueMetricsService } from "./queue-metrics.service"

@Module({
  imports: [
    BullModule.registerQueue({ name: EXTRACTION_AGENT_SESSION_QUEUE_NAME }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    LlmModule,
    DocumentsModule,
    StorageModule,
  ],
  providers: [
    ExtractionAgentSessionExecuteWorker,
    ExtractionAgentSessionRunnerService,
    ExtractionAgentSessionStatusNotifierService,
    ExtractionAgentSessionQueueMetricsService,
  ],
})
export class ExtractionAgentSessionWorkersModule {}
