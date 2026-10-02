import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { AgentCsvExtractionRunContextResolver } from "@/common/context/resolvers/agent-csv-extraction-run-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { AgentSettingsModule } from "@/domains/agents/settings/agent-settings.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { Agent } from "../agent.entity"
import { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
import { AgentCsvExtractionRunBatchModule } from "./agent-csv-extraction-run-batch.module"
import { AgentCsvExtractionRunCsvExportService } from "./agent-csv-extraction-run-csv-export.service"
import { AgentCsvExtractionRunPlaygroundGuard } from "./agent-csv-extraction-run-playground.guard"
import { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"
import { AgentCsvExtractionRunStatusNotifierService } from "./agent-csv-extraction-run-status-notifier.service"
import { AgentCsvExtractionRunStatusStreamService } from "./agent-csv-extraction-run-status-stream.service"
import { AgentCsvExtractionRunsController } from "./agent-csv-extraction-runs.controller"
import { AgentCsvExtractionRunsService } from "./agent-csv-extraction-runs.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      AgentSettings,
      AgentCsvExtractionRun,
      AgentCsvExtractionRunRecord,
      Organization,
      Project,
    ]),
    AgentCsvExtractionRunBatchModule,
    forwardRef(() => AgentSettingsModule),
    DocumentsModule,
    StorageModule,
    OrganizationsModule,
    ProjectsModule,
    UsersModule,
    AuthModule,
    RbacModule,
  ],
  providers: [
    AgentContextResolver,
    AgentCsvExtractionRunContextResolver,
    AgentCsvExtractionRunCsvExportService,
    AgentCsvExtractionRunPlaygroundGuard,
    AgentCsvExtractionRunStatusNotifierService,
    AgentCsvExtractionRunStatusStreamService,
    AgentCsvExtractionRunsService,
    OrganizationContextResolver,
    ProjectContextResolver,
    ResourceContextGuard,
  ],
  controllers: [AgentCsvExtractionRunsController],
  exports: [AgentCsvExtractionRunsService],
})
export class AgentCsvExtractionRunsModule {}
