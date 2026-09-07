import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { PdfPagesModule } from "@/domains/documents/pdf-pages/pdf-pages.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { LlmModule } from "@/external/llm/llm.module"
import { EXTRACTION_AGENT_SESSION_QUEUE_NAME } from "./extraction-agent-session.constants"
import { ExtractionAgentSessionExecuteWorker } from "./extraction-agent-session-execute.worker"
import { ExtractionAgentSessionRunLlmService } from "./extraction-agent-session-run-llm.service"
import { ExtractionAgentSessionStatusNotifierService } from "./extraction-agent-session-status-notifier.service"
import { ExtractionAgentSessionQueueMetricsService } from "./queue-metrics.service"

@Module({
  imports: [
    BullModule.registerQueue({ name: EXTRACTION_AGENT_SESSION_QUEUE_NAME }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    LlmModule,
    DocumentsModule,
    PdfPagesModule,
    StorageModule,
    // ExtractionAgentSessionRunLlmService injects ProjectsService (flex service tier lookup).
    ProjectsModule,
  ],
  providers: [
    ExtractionAgentSessionExecuteWorker,
    ExtractionAgentSessionRunLlmService,
    ExtractionAgentSessionStatusNotifierService,
    ExtractionAgentSessionQueueMetricsService,
    ProjectRepository,
  ],
})
export class ExtractionAgentSessionWorkersModule {}
