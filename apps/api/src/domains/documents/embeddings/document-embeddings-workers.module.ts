import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { ProjectEmbeddingModelsModule } from "@/domains/documents/embeddings/project-embedding-models/project-embedding-models.module"
import { LocalEmbeddingsModule } from "@/external/local-embeddings/local-embeddings.module"
import { DocumentsService } from "../documents.service"
import { PdfPagesModule } from "../pdf-pages/pdf-pages.module"
import { DocumentSourceRepository } from "../sources/document-source.repository"
import { DocumentSourcesService } from "../sources/document-sources.service"
import { StorageModule } from "../storage/storage.module"
import { DocumentTagRepository } from "../tags/document-tag.repository"
import { DocumentTagsService } from "../tags/document-tags.service"
import { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DOCUMENT_EMBEDDINGS_QUEUE_NAME } from "./document-embeddings.constants"
import { DocumentEmbeddingsWorker } from "./document-embeddings.worker"
import { DocumentEmbeddingsBatchModule } from "./document-embeddings-batch.module"
import { DocumentEmbeddingsProcessorService } from "./document-embeddings-processor.service"
import { DocumentEmbeddingsSharedService } from "./document-embeddings-shared.service"
import { DocumentTextExtractorService } from "./document-text-extractor.service"
import { QueueMetricsService } from "./queue-metrics.service"

@Module({
  imports: [
    BullModule.registerQueue({
      name: DOCUMENT_EMBEDDINGS_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    StorageModule,
    PdfPagesModule,
    DocumentEmbeddingsBatchModule,
    LocalEmbeddingsModule,
    ProjectEmbeddingModelsModule,
  ],
  providers: [
    DocumentEmbeddingsWorker,
    DocumentEmbeddingsProcessorService,
    DocumentEmbeddingsSharedService,
    DocumentEmbeddingStatusNotifierService,
    DocumentTextExtractorService,
    DocumentsService,
    DocumentSourcesService,
    DocumentSourceRepository,
    DocumentTagsService,
    DocumentTagRepository,
    QueueMetricsService,
  ],
})
export class DocumentEmbeddingsWorkersModule {}
