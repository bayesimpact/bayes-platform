import { BullModule } from "@nestjs/bullmq"
import { Module, type Type } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { getBullMqConnection } from "./bullmq.config"
import { WorkersHealthModule } from "./common/workers-health/workers-health.module"
import typeorm from "./config/typeorm"
import {
  AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME,
} from "./domains/agents/csv-extraction-runs/agent-csv-extraction-run.constants"
import { AgentCsvExtractionRunWorkersModule } from "./domains/agents/csv-extraction-runs/agent-csv-extraction-run-workers.module"
import { URL_CRAWLING_QUEUE_NAME } from "./domains/documents/crawling/url-crawling.constants"
import { UrlCrawlingWorkersModule } from "./domains/documents/crawling/url-crawling-workers.module"
import { WEB_SOURCE_EMBEDDINGS_QUEUE_NAME } from "./domains/documents/crawling/web-source-embeddings.constants"
import { WebSourceEmbeddingsWorkersModule } from "./domains/documents/crawling/web-source-embeddings-workers.module"
import { DOCUMENT_EMBEDDINGS_QUEUE_NAME } from "./domains/documents/embeddings/document-embeddings.constants"
import { DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME } from "./domains/documents/embeddings/document-embeddings-stuck.constants"
import { DocumentEmbeddingsWorkersModule } from "./domains/documents/embeddings/document-embeddings-workers.module"
import { StorageModule } from "./domains/documents/storage/storage.module"
import {
  EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME,
  EVALUATION_EXTRACTION_RUN_QUEUE_NAME,
} from "./domains/evaluations/extraction/runs/evaluation-extraction-run.constants"
import { EvaluationExtractionRunWorkersModule } from "./domains/evaluations/extraction/runs/evaluation-extraction-run-workers.module"
import { parseEnabledWorkerQueueNames } from "./worker-pools"

/**
 * Maps each worker module to the queues it owns. A module's `@Processor`s start
 * consuming as soon as the module is imported, so selection happens per-module:
 * a module is loaded when any of its queues is in the enabled set. Queues listed
 * together always travel together (they belong to the same module).
 */
const WORKER_MODULE_REGISTRY: { module: Type<unknown>; queues: string[] }[] = [
  {
    module: EvaluationExtractionRunWorkersModule,
    queues: [EVALUATION_EXTRACTION_RUN_QUEUE_NAME, EVALUATION_EXTRACTION_RUN_EXECUTE_QUEUE_NAME],
  },
  {
    module: AgentCsvExtractionRunWorkersModule,
    queues: [AGENT_CSV_EXTRACTION_RUN_QUEUE_NAME, AGENT_CSV_EXTRACTION_RUN_EXECUTE_QUEUE_NAME],
  },
  {
    module: UrlCrawlingWorkersModule,
    queues: [URL_CRAWLING_QUEUE_NAME],
  },
  {
    module: DocumentEmbeddingsWorkersModule,
    queues: [DOCUMENT_EMBEDDINGS_QUEUE_NAME, DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME],
  },
  {
    module: WebSourceEmbeddingsWorkersModule,
    queues: [WEB_SOURCE_EMBEDDINGS_QUEUE_NAME],
  },
]

const enabledQueueNames = new Set(parseEnabledWorkerQueueNames())
const enabledWorkerModules = WORKER_MODULE_REGISTRY.filter((entry) =>
  entry.queues.some((queue) => enabledQueueNames.has(queue)),
).map((entry) => entry.module)

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => configService.get("typeorm")(),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        connection: getBullMqConnection(),
      }),
    }),
    ...enabledWorkerModules,
    StorageModule,
    WorkersHealthModule,
  ],
})
export class WorkersAppModule {}
