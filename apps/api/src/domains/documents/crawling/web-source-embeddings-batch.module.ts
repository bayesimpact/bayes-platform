import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { BullBoardModule } from "@bull-board/nestjs"
import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { isBullBoardEnabled } from "@/common/bull-board/bull-board-env"
import { BullMqWebSourceEmbeddingsBatchService } from "./bull-mq-web-source-embeddings-batch.service"
import { WEB_SOURCE_EMBEDDINGS_QUEUE_NAME } from "./web-source-embeddings.constants"
import { WEB_SOURCE_EMBEDDINGS_BATCH_SERVICE } from "./web-source-embeddings-batch.interface"

@Module({
  imports: [
    BullModule.registerQueue({
      name: WEB_SOURCE_EMBEDDINGS_QUEUE_NAME,
    }),
    ...(isBullBoardEnabled()
      ? [
          BullBoardModule.forFeature({
            name: WEB_SOURCE_EMBEDDINGS_QUEUE_NAME,
            adapter: BullMQAdapter,
          }),
        ]
      : []),
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
