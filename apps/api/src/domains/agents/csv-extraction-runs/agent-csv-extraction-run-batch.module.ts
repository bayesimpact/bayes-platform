import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { BullBoardModule } from "@bull-board/nestjs"
import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { isBullBoardEnabled } from "@/common/bull-board/bull-board-env"
import {
  AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME,
} from "./agent-csv-extraction-run.constants"
import { AGENT_CSV_EXTRACTION_RUN_BATCH_SERVICE } from "./agent-csv-extraction-run-batch.interface"
import { BullMqAgentCsvExtractionRunBatchService } from "./bull-mq-agent-csv-extraction-run-batch.service"

@Module({
  imports: [
    BullModule.registerQueue({ name: AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME }),
    BullModule.registerQueue({ name: AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME }),
    ...(isBullBoardEnabled()
      ? [
          BullBoardModule.forFeature({
            name: AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
            adapter: BullMQAdapter,
          }),
          BullBoardModule.forFeature({
            name: AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME,
            adapter: BullMQAdapter,
          }),
        ]
      : []),
  ],
  providers: [
    BullMqAgentCsvExtractionRunBatchService,
    {
      provide: AGENT_CSV_EXTRACTION_RUN_BATCH_SERVICE,
      useExisting: BullMqAgentCsvExtractionRunBatchService,
    },
  ],
  exports: [AGENT_CSV_EXTRACTION_RUN_BATCH_SERVICE],
})
export class AgentCsvExtractionRunBatchModule {}
