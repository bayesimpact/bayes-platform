import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DocumentsService } from "../documents.service"
import { PdfPagesModule } from "../pdf-pages/pdf-pages.module"
import { DocumentSourceRepository } from "../sources/document-source.repository"
import { DocumentSourcesService } from "../sources/document-sources.service"
import { StorageModule } from "../storage/storage.module"
import { DocumentTagRepository } from "../tags/document-tag.repository"
import { DocumentTagsService } from "../tags/document-tags.service"
import { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DocumentEmbeddingsBatchModule } from "./document-embeddings-batch.module"
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
    StorageModule,
    PdfPagesModule,
    DocumentEmbeddingsBatchModule,
  ],
  providers: [
    DocumentEmbeddingsStuckSweepWorker,
    DocumentEmbeddingsStuckSweepService,
    DocumentEmbeddingsStuckSweepSchedulerService,
    DocumentEmbeddingStatusNotifierService,
    DocumentsService,
    DocumentSourcesService,
    DocumentSourceRepository,
    DocumentTagsService,
    DocumentTagRepository,
  ],
})
export class DocumentEmbeddingsStuckSweepWorkersModule {}
