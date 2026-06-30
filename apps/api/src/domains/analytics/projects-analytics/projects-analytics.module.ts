import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ProjectMembershipContextResolver } from "@/common/context/resolvers/project-membership-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { ProjectMembershipRepository } from "@/domains/projects/memberships/project-membership.repository"
import { Project } from "@/domains/projects/project.entity"
import { UsersModule } from "@/domains/users/users.module"
import { ProjectsAnalyticsController } from "./projects-analytics.controller"
import { ProjectsAnalyticsGuard } from "./projects-analytics.guard"
import { ProjectsAnalyticsService } from "./projects-analytics.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationAgentSession,
      AgentMessage,
      Project,
      Organization,
      OrganizationMembership,
      ProjectMembership,
    ]),
    AuthModule,
    MembershipsModule,
    UsersModule,
  ],
  providers: [
    ProjectsAnalyticsService,
    ProjectsAnalyticsGuard,
    ProjectMembershipRepository,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    ProjectMembershipContextResolver,
  ],
  controllers: [ProjectsAnalyticsController],
  exports: [ProjectsAnalyticsService],
})
export class ProjectsAnalyticsModule {}
