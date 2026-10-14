import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { BullMqEvaluationExtractionRunBatchService } from "./bull-mq-evaluation-extraction-run-batch.service"
import {
  EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
} from "./evaluation-extraction-run.constants"
import { EVALUATION_EXTRACTION_RUN_BATCH_SERVICE } from "./evaluation-extraction-run-batch.interface"

@Module({
  imports: [
    BullModule.registerQueue({ name: EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME }),
    BullModule.registerQueue({ name: EVALUATION_EXTRACTION_RUN_QUEUE_NAME }),
  ],
  providers: [
    BullMqEvaluationExtractionRunBatchService,
    {
      provide: EVALUATION_EXTRACTION_RUN_BATCH_SERVICE,
      useExisting: BullMqEvaluationExtractionRunBatchService,
    },
  ],
  exports: [EVALUATION_EXTRACTION_RUN_BATCH_SERVICE],
})
export class EvaluationExtractionRunBatchModule {}
