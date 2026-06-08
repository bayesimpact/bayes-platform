import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { LlmModule } from "@/external/llm/llm.module"
import {
  AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME,
} from "./agent-csv-extraction-run.constants"
import { AgentCsvExtractionRunWorker } from "./agent-csv-extraction-run.worker"
import { AgentCsvExtractionRunCsvExportService } from "./agent-csv-extraction-run-csv-export.service"
import { AgentCsvExtractionRunExecuteWorker } from "./agent-csv-extraction-run-execute.worker"
import { AgentCsvExtractionRunProcessorService } from "./agent-csv-extraction-run-processor.service"
import { AgentCsvExtractionRunStarterService } from "./agent-csv-extraction-run-starter.service"
import { AgentCsvExtractionRunStatusNotifierService } from "./agent-csv-extraction-run-status-notifier.service"

@Module({
  imports: [
    BullModule.registerQueue({ name: AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME }),
    BullModule.registerQueue({ name: AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    LlmModule,
    DocumentsModule,
    StorageModule,
  ],
  providers: [
    AgentCsvExtractionRunExecuteWorker,
    AgentCsvExtractionRunStarterService,
    AgentCsvExtractionRunWorker,
    AgentCsvExtractionRunProcessorService,
    AgentCsvExtractionRunStatusNotifierService,
    AgentCsvExtractionRunCsvExportService,
  ],
})
export class AgentCsvExtractionRunWorkersModule {}
