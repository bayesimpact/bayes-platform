import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { BullMqWebSourceEmbeddingsBatchService } from "./bull-mq-web-source-embeddings-batch.service"
import { WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE } from "./web-source-embeddings-batch.interface"
import { WEB_SOURCE_EMBEDDINGS_QUEUE_NAME } from "./web-source-embeddings.constants"

@Module({
  imports: [
    BullModule.registerQueue({
      name: WEB_SOURCE_EMBEDDINGS_QUEUE_NAME,
    }),
  ],
  providers: [
    BullMqWebSourceEmbeddingsBatchService,
    {
      provide: WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE,
      useExisting: BullMqWebSourceEmbeddingsBatchService,
    },
  ],
  exports: [WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE],
})
export class WebSourceEmbeddingsBatchModule {}
