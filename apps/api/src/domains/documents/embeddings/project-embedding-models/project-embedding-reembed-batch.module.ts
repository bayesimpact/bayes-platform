import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { BullMqProjectEmbeddingReembedBatchService } from "./bull-mq-project-embedding-reembed-batch.service"
import { PROJECT_EMBEDDING_REEMBED_QUEUE_NAME } from "./project-embedding-reembed.constants"
import { PROJECT_EMBEDDING_REEMBED_BATCH_SERVICE } from "./project-embedding-reembed-batch.interface"

/** Producer side of the re-embedding queue (API and workers). */
@Module({
  imports: [
    BullModule.registerQueue({
      name: PROJECT_EMBEDDING_REEMBED_QUEUE_NAME,
    }),
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
