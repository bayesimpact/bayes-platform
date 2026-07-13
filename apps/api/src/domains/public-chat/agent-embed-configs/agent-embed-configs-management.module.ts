import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentGuard } from "@/domains/agents/agent.guard"
import { AuthModule } from "@/domains/auth/auth.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { UsersModule } from "@/domains/users/users.module"
import { AgentEmbedConfig } from "./agent-embed-config.entity"
import { AgentEmbedConfigsService } from "./agent-embed-configs.service"
import { AgentEmbedConfigsManagementController } from "./agent-embed-configs-management.controller"

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEmbedConfig, Agent, Project]),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
  ],
  providers: [
    AgentEmbedConfigsService,
    AgentGuard,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    AgentContextResolver,
  ],
  controllers: [AgentEmbedConfigsManagementController],
})
export class AgentEmbedConfigsManagementModule {}
