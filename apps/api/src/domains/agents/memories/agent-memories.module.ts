import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ProjectMembershipContextResolver } from "@/common/context/resolvers/project-membership-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { Agent } from "@/domains/agents/agent.entity"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { Organization } from "@/domains/organizations/organization.entity"
import { ProjectMembershipRepository } from "@/domains/projects/memberships/project-membership.repository"
import { Project } from "@/domains/projects/project.entity"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { AgentMemoriesController } from "./agent-memories.controller"
import { AgentMemoriesStoreModule } from "./agent-memories-store.module"

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, Project, Organization]),
    AgentMemoriesStoreModule,
    AuthModule,
    MembershipsModule,
    RbacModule,
    UsersModule,
  ],
  providers: [
    ProjectMembershipRepository,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    ProjectMembershipContextResolver,
    AgentContextResolver,
  ],
  controllers: [AgentMemoriesController],
})
export class AgentMemoriesModule {}
