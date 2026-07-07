import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ProjectMembershipContextResolver } from "@/common/context/resolvers/project-membership-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { Organization } from "@/domains/organizations/organization.entity"
import { ProjectMembershipRepository } from "@/domains/projects/memberships/project-membership.repository"
import { Project } from "@/domains/projects/project.entity"
import { UsersModule } from "@/domains/users/users.module"
import { AgentsAnalyticsController } from "./agents-analytics.controller"
import { AgentsAnalyticsGuard } from "./agents-analytics.guard"
import { AgentsAnalyticsService } from "./agents-analytics.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationAgentSession,
      AgentMessage,
      Agent,
      Project,
      Organization,
    ]),
    AuthModule,
    MembershipsModule,
    UsersModule,
  ],
  providers: [
    AgentsAnalyticsService,
    AgentsAnalyticsGuard,
    ProjectMembershipRepository,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    ProjectMembershipContextResolver,
    AgentContextResolver,
  ],
  controllers: [AgentsAnalyticsController],
  exports: [AgentsAnalyticsService],
})
export class AgentsAnalyticsModule {}
