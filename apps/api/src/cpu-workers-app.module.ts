import { Module } from "@nestjs/common"
import { WorkersHealthModule } from "./common/workers-health/workers-health.module"
import { AgentCsvExtractionRunWorkersModule } from "./domains/agents/csv-extraction-runs/agent-csv-extraction-run-workers.module"
import { UrlCrawlingWorkersModule } from "./domains/documents/crawling/url-crawling-workers.module"
import { StorageModule } from "./domains/documents/storage/storage.module"
import { EVALUATION_EXTRACTION_RUN_QUEUE_NAME } from "./domains/evaluations/extraction/runs/evaluation-extraction-run.constants"
import { EvaluationExtractionRunWorkersModule } from "./domains/evaluations/extraction/runs/evaluation-extraction-run-workers.module"
import { WorkersSharedModule } from "./workers-shared.module"

/**
 * CPU worker pool: consumes extraction-run and URL-crawling queues.
 *
 * These jobs are pure CPU / remote-API work (Vertex LLM, Spider API, DB reads)
 * with no Docling/PyTorch dependency, so this process runs from the lightweight
 * `cpu-workers-runtime` image with no GPU allocation. Embeddings (Docling) stay
 * on the GPU pool in GpuWorkersAppModule.
 */
@Module({
  imports: [
    WorkersSharedModule,
    AgentCsvExtractionRunWorkersModule,
    EvaluationExtractionRunWorkersModule,
    UrlCrawlingWorkersModule,
    StorageModule,
    WorkersHealthModule.forRoot(EVALUATION_EXTRACTION_RUN_QUEUE_NAME),
  ],
})
export class CpuWorkersAppModule {}
