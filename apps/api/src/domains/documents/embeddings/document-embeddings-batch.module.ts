import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Document } from "../document.entity"
import { BullMqDocumentEmbeddingsBatchService } from "./bull-mq-document-embeddings-batch.service"
import { DocumentEmbeddingQueueSyncService } from "./document-embedding-queue-sync.service"
import { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DOCUMENT_EMBEDDINGS_QUEUE_NAME } from "./document-embeddings.constants"
import { DOCUMENT_EMBEDDINGS_BATCH_SERVICE } from "./document-embeddings-batch.interface"

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    BullModule.registerQueue({
      name: DOCUMENT_EMBEDDINGS_QUEUE_NAME,
    }),
  ],
  providers: [
    DocumentEmbeddingStatusNotifierService,
    DocumentEmbeddingQueueSyncService,
    BullMqDocumentEmbeddingsBatchService,
    {
      provide: DOCUMENT_EMBEDDINGS_BATCH_SERVICE,
      useExisting: BullMqDocumentEmbeddingsBatchService,
    },
  ],
  exports: [DOCUMENT_EMBEDDINGS_BATCH_SERVICE],
})
export class DocumentEmbeddingsBatchModule {}
