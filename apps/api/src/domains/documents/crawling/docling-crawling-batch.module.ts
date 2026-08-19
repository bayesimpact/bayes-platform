import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { BullBoardModule } from "@bull-board/nestjs"
import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { getBullMqConnection } from "@/bullmq.config"
import { isBullBoardEnabled } from "@/common/bull-board/bull-board-env"
import { BullMqDoclingCrawlingBatchService } from "./bull-mq-docling-crawling-batch.service"
import { DoclingCrawlGenerationService } from "./docling-crawl-generation.service"
import { DOCLING_CRAWLING_QUEUE_NAME } from "./docling-crawling.constants"
import { DOCLING_CRAWLING_BATCH_SERVICE } from "./docling-crawling-batch.interface"

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
    ...(isBullBoardEnabled()
      ? [
          BullBoardModule.forFeature({
            name: DOCLING_CRAWLING_QUEUE_NAME,
            adapter: BullMQAdapter,
          }),
        ]
      : []),
  ],
  providers: [
    BullMqDoclingCrawlingBatchService,
    DoclingCrawlGenerationService,
    {
      provide: DOCLING_CRAWLING_BATCH_SERVICE,
      useExisting: BullMqDoclingCrawlingBatchService,
    },
  ],
  exports: [DOCLING_CRAWLING_BATCH_SERVICE],
})
export class DoclingCrawlingBatchModule {}
