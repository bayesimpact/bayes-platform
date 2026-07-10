import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { DocumentContextResolver } from "@/common/context/resolvers/document-context.resolver"
import { EvaluationContextResolver } from "@/common/context/resolvers/evaluation-context.resolver"
import { EvaluationExtractionDatasetContextResolver } from "@/common/context/resolvers/evaluation-extraction-dataset-context.resolver"
import { EvaluationExtractionRunContextResolver } from "@/common/context/resolvers/evaluation-extraction-run-context.resolver"
import { EvaluationReportContextResolver } from "@/common/context/resolvers/evaluation-report-context.resolver"
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
import { Evaluation } from "./evaluation.entity"
import { EvaluationGuard } from "./evaluation.guard"
import { EvaluationsController } from "./evaluations.controller"
import { EvaluationsService } from "./evaluations.service"
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
import { EvaluationReport } from "./reports/evaluation-report.entity"
import { EvaluationReportGuard } from "./reports/evaluation-report.guard"
import { EvaluationReportsController } from "./reports/evaluation-reports.controller"
import { EvaluationReportsService } from "./reports/evaluation-reports.service"

@Module({
  imports: [
    LlmModule,
    TypeOrmModule.forFeature([
      Agent,
      AgentSettings,
      Evaluation,
      EvaluationExtractionDataset,
      EvaluationExtractionDatasetDocument,
      EvaluationExtractionDatasetRecord,
      EvaluationReport,
      EvaluationExtractionRun,
      EvaluationExtractionRunRecord,
      Organization,
      Project,
    ]),
    AgentsModule,
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
    EvaluationContextResolver,
    DocumentContextResolver,
    EvaluationExtractionDatasetContextResolver,
    EvaluationExtractionDatasetGuard,
    EvaluationExtractionDatasetsService,
    EvaluationGuard,
    EvaluationExtractionRunContextResolver,
    EvaluationExtractionRunCsvExportService,
    EvaluationExtractionRunGraderService,
    EvaluationExtractionRunGuard,
    EvaluationExtractionRunStatusNotifierService,
    EvaluationExtractionRunStatusStreamService,
    EvaluationExtractionRunsService,
    EvaluationReportContextResolver,
    EvaluationReportGuard,
    EvaluationReportsService,
    EvaluationsService,
    OrganizationContextResolver,
    ProjectContextResolver,
    ResourceContextGuard,
  ],
  controllers: [
    EvaluationsController,
    EvaluationExtractionDatasetsController,
    EvaluationReportsController,
    EvaluationExtractionRunsController,
  ],
  exports: [
    EvaluationsService,
    EvaluationExtractionDatasetsService,
    EvaluationReportsService,
    EvaluationExtractionRunsService,
  ],
})
export class EvaluationsModule {}
