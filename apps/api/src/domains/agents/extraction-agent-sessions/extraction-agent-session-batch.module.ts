import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { BullMqExtractionAgentSessionBatchService } from "./bull-mq-extraction-agent-session-batch.service"
import { EXTRACTION_AGENT_SESSION_QUEUE_NAME } from "./extraction-agent-session.constants"
import { EXTRACTION_AGENT_SESSION_BATCH_SERVICE } from "./extraction-agent-session-batch.interface"

@Module({
  imports: [BullModule.registerQueue({ name: EXTRACTION_AGENT_SESSION_QUEUE_NAME })],
  providers: [
    BullMqExtractionAgentSessionBatchService,
    {
      provide: EXTRACTION_AGENT_SESSION_BATCH_SERVICE,
      useExisting: BullMqExtractionAgentSessionBatchService,
    },
  ],
  exports: [EXTRACTION_AGENT_SESSION_BATCH_SERVICE],
})
export class ExtractionAgentSessionBatchModule {}
