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
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { UsersModule } from "@/domains/users/users.module"
import { LlmModule } from "@/external/llm/llm.module"
import { InvitationsModule } from "../invitations/invitations.module"
import { ProjectsModule } from "../projects/projects.module"
import { ResourceLibrariesModule } from "../resource-libraries/resource-libraries.module"
import { Agent } from "./agent.entity"
import { AgentGuard } from "./agent.guard"
import { AgentsController } from "./agents.controller"
import { AgentsService } from "./agents.service"
import { BaseAgentSessionsService } from "./base-agent-sessions/base-agent-sessions.service"
import { AgentMembership } from "./memberships/agent-membership.entity"
import { AgentMembershipsController } from "./memberships/agent-memberships.controller"
import { AgentMembershipsGuard } from "./memberships/agent-memberships.guard"
import { AgentMembershipsService } from "./memberships/agent-memberships.service"
import { AgentSessionCategoriesService } from "./session-categories/agent-session-categories.service"
import { AgentSessionCategory } from "./session-categories/agent-session-category.entity"
import { ProjectAgentSessionCategoriesController } from "./session-categories/project-agent-session-categories.controller"
import { ProjectAgentSessionCategoriesGuard } from "./session-categories/project-agent-session-categories.guard"
import { ProjectAgentSessionCategoriesService } from "./session-categories/project-agent-session-categories.service"
import { ProjectAgentSessionCategory } from "./session-categories/project-agent-session-category.entity"
import { AgentSubAgent } from "./sub-agents/agent-sub-agent.entity"
import { AgentSubAgentsService } from "./sub-agents/agent-sub-agents.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      AgentSessionCategory,
      AgentSubAgent,
      ProjectAgentSessionCategory,
      AgentMembership,
      Project,
      OrganizationMembership,
      ProjectMembership,
    ]),
    LlmModule,
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
    AgentSessionCategoriesService,
    AgentSubAgentsService,
    ProjectAgentSessionCategoriesService,
    BaseAgentSessionsService,
    AgentMembershipsService,
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
    AgentMembershipsService,
    AgentSubAgentsService,
  ],
})
export class AgentsModule {}
