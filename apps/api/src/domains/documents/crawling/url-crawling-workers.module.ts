import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { getBullMqConnection } from "@/bullmq.config"
import { ALL_ENTITIES } from "@/common/all-entities"
import { SpiderClientService } from "@/external/spider/spider-client.service"
import { DocumentsService } from "../documents.service"
import { DocumentEmbeddingStatusNotifierService } from "../embeddings/document-embedding-status-notifier.service"
import { DocumentTagsService } from "../tags/document-tags.service"
import { DocumentCrawlProgressNotifierService } from "./document-crawl-progress-notifier.service"
import { URL_CRAWLING_QUEUE_NAME } from "./url-crawling.constants"
import { UrlCrawlingWorker } from "./url-crawling.worker"
import { UrlCrawlingProcessorService } from "./url-crawling-processor.service"
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
      name: URL_CRAWLING_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    WebSourceEmbeddingsBatchModule,
  ],
  providers: [
    UrlCrawlingWorker,
    UrlCrawlingProcessorService,
    SpiderClientService,
    DocumentsService,
    DocumentTagsService,
    DocumentEmbeddingStatusNotifierService,
    DocumentCrawlProgressNotifierService,
  ],
})
export class UrlCrawlingWorkersModule {}
