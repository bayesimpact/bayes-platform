import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { LlmModule } from "@/external/llm/llm.module"
import {
  EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
} from "./evaluation-extraction-run.constants"
import { EvaluationExtractionRunWorker } from "./evaluation-extraction-run.worker"
import { EvaluationExtractionRunCsvExportService } from "./evaluation-extraction-run-csv-export.service"
import { EvaluationExtractionRunExecuteWorker } from "./evaluation-extraction-run-execute.worker"
import { EvaluationExtractionRunGraderService } from "./evaluation-extraction-run-grader.service"
import { EvaluationExtractionRunProcessorService } from "./evaluation-extraction-run-processor.service"
import { EvaluationExtractionRunStarterService } from "./evaluation-extraction-run-starter.service"
import { EvaluationExtractionRunStatusNotifierService } from "./evaluation-extraction-run-status-notifier.service"
import { QueueMetricsService } from "./queue-metrics.service"

@Module({
  imports: [
    BullModule.registerQueue({ name: EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME }),
    BullModule.registerQueue({ name: EVALUATION_EXTRACTION_RUN_QUEUE_NAME }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    LlmModule,
    DocumentsModule,
    StorageModule,
  ],
  providers: [
    EvaluationExtractionRunExecuteWorker,
    EvaluationExtractionRunStarterService,
    EvaluationExtractionRunWorker,
    EvaluationExtractionRunProcessorService,
    EvaluationExtractionRunStatusNotifierService,
    EvaluationExtractionRunGraderService,
    EvaluationExtractionRunCsvExportService,
    QueueMetricsService,
  ],
})
export class EvaluationExtractionRunWorkersModule {}
