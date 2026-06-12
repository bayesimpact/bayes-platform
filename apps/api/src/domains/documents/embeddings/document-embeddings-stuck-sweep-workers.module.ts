import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DocumentsService } from "../documents.service"
import { DocumentTagsService } from "../tags/document-tags.service"
import { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME } from "./document-embeddings-stuck.constants"
import { DocumentEmbeddingsStuckSweepService } from "./document-embeddings-stuck-sweep.service"
import { DocumentEmbeddingsStuckSweepWorker } from "./document-embeddings-stuck-sweep.worker"
import { DocumentEmbeddingsStuckSweepSchedulerService } from "./document-embeddings-stuck-sweep-scheduler.service"

@Module({
  imports: [
    BullModule.registerQueue({
      name: DOCUMENT_EMBEDDINGS_STUCK_SWEEP_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  ],
  providers: [
    DocumentEmbeddingsStuckSweepWorker,
    DocumentEmbeddingsStuckSweepService,
    DocumentEmbeddingsStuckSweepSchedulerService,
    DocumentEmbeddingStatusNotifierService,
    DocumentsService,
    DocumentTagsService,
  ],
})
export class DocumentEmbeddingsStuckSweepWorkersModule {}
