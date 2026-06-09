import { Module } from "@nestjs/common"
import { WorkersHealthModule } from "./common/workers-health/workers-health.module"
import { WebSourceEmbeddingsWorkersModule } from "./domains/documents/crawling/web-source-embeddings-workers.module"
import { DOCUMENT_EMBEDDINGS_QUEUE_NAME } from "./domains/documents/embeddings/document-embeddings.constants"
import { DocumentEmbeddingsWorkersModule } from "./domains/documents/embeddings/document-embeddings-workers.module"
import { StorageModule } from "./domains/documents/storage/storage.module"
import { WorkersSharedModule } from "./workers-shared.module"

/**
 * GPU worker pool: consumes the document-embeddings and web-source-embeddings
 * queues. Both depend on Docling (local PyTorch text extraction), so this
 * process runs from the `gpu-workers-runtime` image on GPU hardware.
 *
 * Extraction-run and URL-crawling jobs are CPU-only and live in
 * CpuWorkersAppModule (cpu-workers-runtime image) instead.
 */
@Module({
  imports: [
    WorkersSharedModule,
    DocumentEmbeddingsWorkersModule,
    WebSourceEmbeddingsWorkersModule,
    StorageModule,
    WorkersHealthModule.forRoot(DOCUMENT_EMBEDDINGS_QUEUE_NAME),
  ],
})
export class GpuWorkersAppModule {}
