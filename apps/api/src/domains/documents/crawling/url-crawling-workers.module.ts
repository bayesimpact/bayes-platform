import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { SpiderClientService } from "@/external/spider/spider-client.service"
import { DocumentsService } from "../documents.service"
import { WebSourceEmbeddingsBatchModule } from "./web-source-embeddings-batch.module"
import { getBullMqConnection } from "@/bullmq.config"
import { DocumentTagsService } from "../tags/document-tags.service"
import { URL_CRAWLING_QUEUE_NAME } from "./url-crawling.constants"
import { UrlCrawlingWorker } from "./url-crawling.worker"
import { UrlCrawlingProcessorService } from "./url-crawling-processor.service"

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
  ],
})
export class UrlCrawlingWorkersModule {}
