import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { BullBoardModule } from "@bull-board/nestjs"
import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { isBullBoardEnabled } from "@/common/bull-board/bull-board-env"
import { BullMqProjectEmbeddingReembedBatchService } from "./bull-mq-project-embedding-reembed-batch.service"
import { PROJECT_EMBEDDING_REEMBED_QUEUE_NAME } from "./project-embedding-reembed.constants"
import { PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE } from "./project-embedding-reembed-batch.interface"

/** Producer side of the re-embedding queue (API and workers). */
@Module({
  imports: [
    BullModule.registerQueue({
      name: PROJECT_EMBEDDING_REEMBED_QUEUE_NAME,
    }),
    ...(isBullBoardEnabled()
      ? [
          BullBoardModule.forFeature({
            name: PROJECT_EMBEDDING_REEMBED_QUEUE_NAME,
            adapter: BullMQAdapter,
          }),
        ]
      : []),
  ],
  providers: [
    BullMqProjectEmbeddingReembedBatchService,
    {
      provide: PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE,
      useExisting: BullMqProjectEmbeddingReembedBatchService,
    },
  ],
  exports: [PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE],
})
export class ProjectEmbeddingReembedBatchModule {}
