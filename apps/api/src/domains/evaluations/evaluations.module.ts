import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { AgentMessageRepository } from "@/domains/agents/shared/agent-session-messages/agent-message.repository"
import { AuthModule } from "@/domains/auth/auth.module"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { LlmModule } from "@/external/llm/llm.module"
import { Agent } from "../agents/agent.entity"
import { EvaluationConversationDataset } from "./conversation/datasets/evaluation-conversation-dataset.entity"
import { EvaluationConversationDatasetRepository } from "./conversation/datasets/evaluation-conversation-dataset.repository"
import { EvaluationConversationDatasetsController } from "./conversation/datasets/evaluation-conversation-datasets.controller"
import { EvaluationConversationDatasetsService } from "./conversation/datasets/evaluation-conversation-datasets.service"
import { EvaluationConversationDatasetRecord } from "./conversation/datasets/records/evaluation-conversation-dataset-record.entity"
import { EvaluationConversationDatasetRecordRepository } from "./conversation/datasets/records/evaluation-conversation-dataset-record.repository"
import { EvaluationConversationRun } from "./conversation/runs/evaluation-conversation-run.entity"
import { EvaluationConversationRunBatchModule } from "./conversation/runs/evaluation-conversation-run-batch.module"
import { EvaluationConversationRunGraderLlmService } from "./conversation/runs/evaluation-conversation-run-grader-llm.service"
import { EvaluationConversationRunStatusNotifierService } from "./conversation/runs/evaluation-conversation-run-status-notifier.service"
import { EvaluationConversationRunStatusStreamService } from "./conversation/runs/evaluation-conversation-run-status-stream.service"
import { EvaluationConversationRunsService } from "./conversation/runs/evaluation-conversation-runs.service"
import { EvaluationConversationRunRecord } from "./conversation/runs/records/evaluation-conversation-run-record.entity"
import { EvaluationConversationRunRecordRepository } from "./conversation/runs/records/evaluation-conversation-run-record.repository"
import { EvaluationConversationTestCaseLlmService } from "./conversation/test-cases/evaluation-conversation-test-case-llm.service"
import { EvaluationConversationTestCasesController } from "./conversation/test-cases/evaluation-conversation-test-cases.controller"
import { EvaluationConversationTestCasesService } from "./conversation/test-cases/evaluation-conversation-test-cases.service"
import { EvaluationExtractionDataset } from "./extraction/datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetDocument } from "./extraction/datasets/evaluation-extraction-dataset-document.entity"
import { EvaluationExtractionDatasetDocumentRepository } from "./extraction/datasets/evaluation-extraction-dataset-document.repository"
import { EvaluationExtractionDatasetsService } from "./extraction/datasets/evaluation-extraction-datasets.service"
import { EvaluationExtractionDatasetRecord } from "./extraction/datasets/records/evaluation-extraction-dataset-record.entity"
import { EvaluationExtractionRun } from "./extraction/runs/evaluation-extraction-run.entity"
import { EvaluationExtractionRunBatchModule } from "./extraction/runs/evaluation-extraction-run-batch.module"
import { EvaluationExtractionRunCsvExportService } from "./extraction/runs/evaluation-extraction-run-csv-export.service"
import { EvaluationExtractionRunGraderService } from "./extraction/runs/evaluation-extraction-run-grader.service"
import { EvaluationExtractionRunStatusNotifierService } from "./extraction/runs/evaluation-extraction-run-status-notifier.service"
import { EvaluationExtractionRunStatusStreamService } from "./extraction/runs/evaluation-extraction-run-status-stream.service"
import { EvaluationExtractionRunsService } from "./extraction/runs/evaluation-extraction-runs.service"
import { EvaluationExtractionRunRecord } from "./extraction/runs/records/evaluation-extraction-run-record.entity"

@Module({
  imports: [
    LlmModule,
    TypeOrmModule.forFeature([
      Agent,
      AgentSettings,
      EvaluationConversationDataset,
      EvaluationConversationDatasetRecord,
      EvaluationConversationRun,
      EvaluationConversationRunRecord,
      EvaluationExtractionDataset,
      EvaluationExtractionDatasetDocument,
      EvaluationExtractionDatasetRecord,
      EvaluationExtractionRun,
      EvaluationExtractionRunRecord,
      Organization,
      Project,
    ]),
    AgentsModule,
    EvaluationConversationRunBatchModule,
    EvaluationExtractionRunBatchModule,
    DocumentsModule,
    StorageModule,
    OrganizationsModule,
    ProjectsModule,
    RbacModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    // Provided here rather than exported by the conversation sessions module, which sits in
    // forwardRef cycles with the agents module.
    AgentMessageRepository,
    EvaluationConversationDatasetRecordRepository,
    EvaluationConversationDatasetRepository,
    EvaluationConversationDatasetsService,
    EvaluationConversationRunGraderLlmService,
    EvaluationConversationRunStatusNotifierService,
    EvaluationConversationRunStatusStreamService,
    EvaluationConversationRunsService,
    EvaluationConversationRunRecordRepository,
    EvaluationConversationTestCaseLlmService,
    EvaluationConversationTestCasesService,
    EvaluationExtractionDatasetDocumentRepository,
    EvaluationExtractionDatasetsService,
    EvaluationExtractionRunCsvExportService,
    EvaluationExtractionRunGraderService,
    EvaluationExtractionRunStatusNotifierService,
    EvaluationExtractionRunStatusStreamService,
    EvaluationExtractionRunsService,
    OrganizationContextResolver,
    ProjectContextResolver,
    ResourceContextGuard,
  ],
  // Evaluation serves its own routes from `src/domains/eval/`. These two serve the Studio.
  controllers: [
    EvaluationConversationDatasetsController,
    EvaluationConversationTestCasesController,
  ],
  exports: [
    // The context resolver of a dataset document reads it, in `EvaluationContextModule`.
    EvaluationExtractionDatasetDocumentRepository,
    EvaluationConversationDatasetsService,
    EvaluationExtractionDatasetsService,
    EvaluationConversationRunsService,
    // The Evaluation module's cancel handler announces the new status of a run.
    EvaluationConversationRunStatusNotifierService,
    EvaluationExtractionRunsService,
    // The Evaluation module's cancel handler exports the results of a cancelled run, and
    // announces its new status.
    EvaluationExtractionRunCsvExportService,
    EvaluationExtractionRunStatusNotifierService,
  ],
})
export class EvaluationsModule {}
