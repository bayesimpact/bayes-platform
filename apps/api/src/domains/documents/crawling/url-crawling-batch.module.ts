import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { getBullMqConnection } from "@/bullmq.config"
import { BullMqUrlCrawlingBatchService } from "./bull-mq-url-crawling-batch.service"
import { URL_CRAWLING_QUEUE_NAME } from "./url-crawling.constants"
import { URL_CRAWLING_BATCH_SERVICE } from "./url-crawling-batch.interface"

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
  ],
  providers: [
    BullMqUrlCrawlingBatchService,
    {
      provide: URL_CRAWLING_BATCH_SERVICE,
      useExisting: BullMqUrlCrawlingBatchService,
    },
  ],
  exports: [URL_CRAWLING_BATCH_SERVICE],
})
export class UrlCrawlingBatchModule {}
