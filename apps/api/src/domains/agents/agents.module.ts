import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { AgentMembershipContextResolver } from "@/common/context/resolvers/agent-membership-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { ExtractionAgentSessionsModule } from "@/domains/agents/extraction-agent-sessions/extraction-agent-sessions.module"
import { FormAgentSessionsModule } from "@/domains/agents/form-agent-sessions/form-agent-sessions.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { DocumentTagsModule } from "@/domains/documents/tags/document-tags.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { UsersModule } from "@/domains/users/users.module"
import { LlmModule } from "@/external/llm/llm.module"
import { InvitationsModule } from "../invitations/invitations.module"
import { ProjectsModule } from "../projects/projects.module"
import { ResourceLibrariesModule } from "../resource-libraries/resource-libraries.module"
import { Agent } from "./agent.entity"
import { AgentGuard } from "./agent.guard"
import { AgentRepository } from "./agent.repository"
import { AgentsController } from "./agents.controller"
import { AgentsService } from "./agents.service"
import { BaseAgentSessionsService } from "./base-agent-sessions/base-agent-sessions.service"
import { AgentMembershipsController } from "./memberships/agent-memberships.controller"
import { AgentMembershipsGuard } from "./memberships/agent-memberships.guard"
import { AgentMembershipRepository } from "./memberships/agent-membership.repository"
import { AgentMembershipsService } from "./memberships/agent-memberships.service"
import { AgentSessionCategoriesService } from "./session-categories/agent-session-categories.service"
import { AgentSessionCategory } from "./session-categories/agent-session-category.entity"
import { ProjectAgentSessionCategoriesController } from "./session-categories/project-agent-session-categories.controller"
import { ProjectAgentSessionCategoriesGuard } from "./session-categories/project-agent-session-categories.guard"
import { ProjectAgentSessionCategoriesService } from "./session-categories/project-agent-session-categories.service"
import { ProjectAgentSessionCategory } from "./session-categories/project-agent-session-category.entity"
import { AgentSettings } from "./settings/agent-settings.entity"
import { AgentSettingsService } from "./settings/agent-settings.service"
import { AgentSubAgent } from "./sub-agents/agent-sub-agent.entity"
import { AgentSubAgentsService } from "./sub-agents/agent-sub-agents.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      AgentSessionCategory,
      AgentSubAgent,
      ProjectAgentSessionCategory,
      Project,
      AgentSettings,
    ]),
    LlmModule,
    MembershipsModule,
    OrganizationsModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => InvitationsModule),
    UsersModule,
    AuthModule,
    forwardRef(() => DocumentsModule),
    forwardRef(() => DocumentTagsModule),
    StorageModule,
    forwardRef(() => ResourceLibrariesModule),
    forwardRef(() => ConversationAgentSessionsModule),
    forwardRef(() => ExtractionAgentSessionsModule),
    forwardRef(() => FormAgentSessionsModule),
  ],
  providers: [
    AgentsService,
    AgentRepository,
    AgentSessionCategoriesService,
    AgentSettingsService,
    AgentSubAgentsService,
    ProjectAgentSessionCategoriesService,
    BaseAgentSessionsService,
    AgentMembershipsService,
    AgentMembershipRepository,
    AgentGuard,
    AgentMembershipsGuard,
    ProjectAgentSessionCategoriesGuard,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    AgentContextResolver,
    AgentMembershipContextResolver,
  ],
  controllers: [
    AgentsController,
    AgentMembershipsController,
    ProjectAgentSessionCategoriesController,
  ],
  exports: [
    AgentsService,
    AgentSessionCategoriesService,
    AgentSettingsService,
    AgentMembershipsService,
    AgentSubAgentsService,
  ],
})
export class AgentsModule {}
