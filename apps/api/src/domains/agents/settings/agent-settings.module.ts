import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { DocumentTagsModule } from "@/domains/documents/tags/document-tags.module"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { ResourceLibrariesModule } from "@/domains/resource-libraries/resource-libraries.module"
import { LlmModule } from "@/external/llm/llm.module"
import { Agent } from "../agent.entity"
import { AgentSessionCategoriesService } from "../session-categories/agent-session-categories.service"
import { AgentSessionCategory } from "../session-categories/agent-session-category.entity"
import { ProjectAgentSessionCategory } from "../session-categories/project-agent-session-category.entity"
import { AgentModelsService } from "./agent-models.service"
import { AgentSettings } from "./agent-settings.entity"
import { AgentSettingsRepository } from "./agent-settings.repository"
import { AgentSettingsService } from "./agent-settings.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      AgentSettings,
      AgentSessionCategory,
      ProjectAgentSessionCategory,
    ]),
    forwardRef(() => DocumentTagsModule),
    forwardRef(() => ResourceLibrariesModule),
    LlmModule,
  ],
  providers: [
    AgentModelsService,
    AgentSessionCategoriesService,
    AgentSettingsRepository,
    AgentSettingsService,
    ProjectRepository,
  ],
  exports: [AgentSettingsService, AgentSettingsRepository],
})
export class AgentSettingsModule {}
