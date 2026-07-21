import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { DocumentContextResolver } from "@/common/context/resolvers/document-context.resolver"
import { EvaluationConversationDatasetContextResolver } from "@/common/context/resolvers/evaluation-conversation-dataset-context.resolver"
import { EvaluationConversationRunContextResolver } from "@/common/context/resolvers/evaluation-conversation-run-context.resolver"
import { EvaluationExtractionDatasetContextResolver } from "@/common/context/resolvers/evaluation-extraction-dataset-context.resolver"
import { EvaluationExtractionRunContextResolver } from "@/common/context/resolvers/evaluation-extraction-run-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { AuthModule } from "@/domains/auth/auth.module"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { UsersModule } from "@/domains/users/users.module"
import { LlmModule } from "@/external/llm/llm.module"
import { Agent } from "../agents/agent.entity"
import { EvaluationConversationDataset } from "./conversation/datasets/evaluation-conversation-dataset.entity"
import { EvaluationConversationDatasetGuard } from "./conversation/datasets/evaluation-conversation-dataset.guard"
import { EvaluationConversationDatasetsController } from "./conversation/datasets/evaluation-conversation-datasets.controller"
import { EvaluationConversationDatasetsService } from "./conversation/datasets/evaluation-conversation-datasets.service"
import { EvaluationConversationDatasetRecord } from "./conversation/datasets/records/evaluation-conversation-dataset-record.entity"
import { EvaluationConversationRun } from "./conversation/runs/evaluation-conversation-run.entity"
import { EvaluationConversationRunGuard } from "./conversation/runs/evaluation-conversation-run.guard"
import { EvaluationConversationRunBatchModule } from "./conversation/runs/evaluation-conversation-run-batch.module"
import { EvaluationConversationRunGraderService } from "./conversation/runs/evaluation-conversation-run-grader.service"
import { EvaluationConversationRunStatusNotifierService } from "./conversation/runs/evaluation-conversation-run-status-notifier.service"
import { EvaluationConversationRunStatusStreamService } from "./conversation/runs/evaluation-conversation-run-status-stream.service"
import { EvaluationConversationRunsController } from "./conversation/runs/evaluation-conversation-runs.controller"
import { EvaluationConversationRunsService } from "./conversation/runs/evaluation-conversation-runs.service"
import { EvaluationConversationRunRecord } from "./conversation/runs/records/evaluation-conversation-run-record.entity"
import { EvaluationExtractionDataset } from "./extraction/datasets/evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetGuard } from "./extraction/datasets/evaluation-extraction-dataset.guard"
import { EvaluationExtractionDatasetDocument } from "./extraction/datasets/evaluation-extraction-dataset-document.entity"
import { EvaluationExtractionDatasetsController } from "./extraction/datasets/evaluation-extraction-datasets.controller"
import { EvaluationExtractionDatasetsService } from "./extraction/datasets/evaluation-extraction-datasets.service"
import { EvaluationExtractionDatasetRecord } from "./extraction/datasets/records/evaluation-extraction-dataset-record.entity"
import { EvaluationExtractionRun } from "./extraction/runs/evaluation-extraction-run.entity"
import { EvaluationExtractionRunGuard } from "./extraction/runs/evaluation-extraction-run.guard"
import { EvaluationExtractionRunBatchModule } from "./extraction/runs/evaluation-extraction-run-batch.module"
import { EvaluationExtractionRunCsvExportService } from "./extraction/runs/evaluation-extraction-run-csv-export.service"
import { EvaluationExtractionRunGraderService } from "./extraction/runs/evaluation-extraction-run-grader.service"
import { EvaluationExtractionRunStatusNotifierService } from "./extraction/runs/evaluation-extraction-run-status-notifier.service"
import { EvaluationExtractionRunStatusStreamService } from "./extraction/runs/evaluation-extraction-run-status-stream.service"
import { EvaluationExtractionRunsController } from "./extraction/runs/evaluation-extraction-runs.controller"
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
    UsersModule,
    AuthModule,
  ],
  providers: [
    AgentContextResolver,
    DocumentContextResolver,
    EvaluationConversationDatasetContextResolver,
    EvaluationConversationDatasetGuard,
    EvaluationConversationDatasetsService,
    EvaluationConversationRunContextResolver,
    EvaluationConversationRunGraderService,
    EvaluationConversationRunGuard,
    EvaluationConversationRunStatusNotifierService,
    EvaluationConversationRunStatusStreamService,
    EvaluationConversationRunsService,
    EvaluationExtractionDatasetContextResolver,
    EvaluationExtractionDatasetGuard,
    EvaluationExtractionDatasetsService,
    EvaluationExtractionRunContextResolver,
    EvaluationExtractionRunCsvExportService,
    EvaluationExtractionRunGraderService,
    EvaluationExtractionRunGuard,
    EvaluationExtractionRunStatusNotifierService,
    EvaluationExtractionRunStatusStreamService,
    EvaluationExtractionRunsService,
    OrganizationContextResolver,
    ProjectContextResolver,
    ResourceContextGuard,
  ],
  controllers: [
    EvaluationConversationDatasetsController,
    EvaluationExtractionDatasetsController,
    EvaluationConversationRunsController,
    EvaluationExtractionRunsController,
  ],
  exports: [
    EvaluationConversationDatasetsService,
    EvaluationExtractionDatasetsService,
    EvaluationConversationRunsService,
    EvaluationExtractionRunsService,
  ],
})
export class EvaluationsModule {}
