import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DocumentsService } from "@/domains/documents/documents.service"
import { DocumentEmbeddingStatusNotifierService } from "@/domains/documents/embeddings/document-embedding-status-notifier.service"
import { DocumentEmbeddingsBatchModule } from "@/domains/documents/embeddings/document-embeddings-batch.module"
import { PdfPagesModule } from "@/domains/documents/pdf-pages/pdf-pages.module"
import { DocumentSourceRepository } from "@/domains/documents/sources/document-source.repository"
import { DocumentSourcesService } from "@/domains/documents/sources/document-sources.service"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { DocumentTagRepository } from "@/domains/documents/tags/document-tag.repository"
import { DocumentTagsService } from "@/domains/documents/tags/document-tags.service"
import { LegacyWebCrawlDocumentRepository } from "./legacy-web-crawl-document.repository"
import { LegacyWebCrawlMigrationJob } from "./legacy-web-crawl-migration.job"

@Module({
  imports: [
    TypeOrmModule.forFeature(ALL_ENTITIES),
    StorageModule,
    PdfPagesModule,
    DocumentEmbeddingsBatchModule,
  ],
  providers: [
    LegacyWebCrawlMigrationJob,
    LegacyWebCrawlDocumentRepository,
    DocumentsService,
    DocumentSourcesService,
    DocumentSourceRepository,
    DocumentTagsService,
    DocumentTagRepository,
    DocumentEmbeddingStatusNotifierService,
  ],
  exports: [LegacyWebCrawlMigrationJob],
})
export class LegacyWebCrawlMigrationModule {}
