import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { getBullMqConnection } from "@/bullmq.config"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DocumentsService } from "../documents.service"
import { DocumentEmbeddingStatusNotifierService } from "../embeddings/document-embedding-status-notifier.service"
import { DocumentEmbeddingsProcessorService } from "../embeddings/document-embeddings-processor.service"
import { DocumentTextExtractorService } from "../embeddings/document-text-extractor.service"
import { StorageModule } from "../storage/storage.module"
import { DocumentTagsService } from "../tags/document-tags.service"
import { WEB_SOURCE_EMBEDDINGS_QUEUE_NAME } from "./web-source-embeddings.constants"
import { WebSourceEmbeddingsWorker } from "./web-source-embeddings.worker"
import { WebSourceEmbeddingsQueueMetricsService } from "./web-source-embeddings-queue-metrics.service"

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        connection: getBullMqConnection(),
      }),
    }),
    BullModule.registerQueue({
      name: WEB_SOURCE_EMBEDDINGS_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    StorageModule,
  ],
  providers: [
    WebSourceEmbeddingsWorker,
    DocumentEmbeddingsProcessorService,
    DocumentEmbeddingStatusNotifierService,
    DocumentTextExtractorService,
    DocumentsService,
    DocumentTagsService,
    WebSourceEmbeddingsQueueMetricsService,
  ],
})
export class WebSourceEmbeddingsWorkersModule {}
