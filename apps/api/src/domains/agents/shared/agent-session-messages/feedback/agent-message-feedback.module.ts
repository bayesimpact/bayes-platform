import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AuthModule } from "@/domains/auth/auth.module"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { UsersModule } from "@/domains/users/users.module"
import { Agent } from "../../../agent.entity"
import { AgentGuard } from "../../../agent.guard"
import { AgentsModule } from "../../../agents.module"
import { AgentMessage } from "../agent-message.entity"
import { AgentMessageFeedbackController } from "./agent-message-feedback.controller"
import { AgentMessageFeedback } from "./agent-message-feedback.entity"
import { AgentMessageFeedbackService } from "./agent-message-feedback.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentMessageFeedback, AgentMessage, Organization, Project, Agent]),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    AgentsModule,
  ],
  providers: [
    AgentMessageFeedbackService,
    AgentGuard,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    AgentContextResolver,
  ],
  controllers: [AgentMessageFeedbackController],
  exports: [AgentMessageFeedbackService],
})
export class AgentMessageFeedbackModule {}
