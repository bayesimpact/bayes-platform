import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { getBullMqConnection } from "@/bullmq.config"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DoclingCrawlerClientService } from "@/external/docling-crawler/docling-crawler-client.service"
import { DocumentsService } from "../documents.service"
import { DocumentEmbeddingStatusNotifierService } from "../embeddings/document-embedding-status-notifier.service"
import { DocumentTagsService } from "../tags/document-tags.service"
import { DoclingCrawlGenerationService } from "./docling-crawl-generation.service"
import { DOCLING_CRAWLING_QUEUE_NAME } from "./docling-crawling.constants"
import { DoclingCrawlingWorker } from "./docling-crawling.worker"
import { DoclingCrawlingProcessorService } from "./docling-crawling-processor.service"
import { DoclingCrawlingQueueMetricsService } from "./docling-crawling-queue-metrics.service"
import { DocumentCrawlProgressNotifierService } from "./document-crawl-progress-notifier.service"
import { WebSourceEmbeddingsBatchModule } from "./web-source-embeddings-batch.module"

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        connection: getBullMqConnection(),
      }),
    }),
    BullModule.registerQueue({
      name: DOCLING_CRAWLING_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    WebSourceEmbeddingsBatchModule,
  ],
  providers: [
    DoclingCrawlingWorker,
    DoclingCrawlingProcessorService,
    DoclingCrawlerClientService,
    DocumentsService,
    DocumentTagsService,
    DocumentEmbeddingStatusNotifierService,
    DocumentCrawlProgressNotifierService,
    DoclingCrawlingQueueMetricsService,
    DoclingCrawlGenerationService,
  ],
})
export class DoclingCrawlingWorkersModule {}
