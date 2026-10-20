import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { AgentContextResolver } from "./resolvers/agent-context.resolver"
import { OrganizationContextResolver } from "./resolvers/organization-context.resolver"
import { ProjectContextResolver } from "./resolvers/project-context.resolver"
import { ResourceContextGuard } from "./resource-context.guard"

const RESOLVERS = [OrganizationContextResolver, ProjectContextResolver, AgentContextResolver]

/**
 * The context resolvers and the entities they read, for a module that must not register the entities
 * of other domains itself (ADR 0031, section 2.13). A module that imports it gets
 * `ResourceContextGuard` with these resolvers. Add a resolver here with the first route that needs it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserMembership, Project, Agent])],
  providers: [ResourceContextGuard, ...RESOLVERS],
  exports: [ResourceContextGuard, ...RESOLVERS],
})
export class ContextModule {}
