import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ProjectMembershipContextResolver } from "@/common/context/resolvers/project-membership-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { AgentsModule } from "../agents/agents.module"
import { DocumentTagsModule } from "../documents/tags/document-tags.module"
import { ProjectMembershipRepository } from "./memberships/project-membership.repository"
import { ProjectMembershipsController } from "./memberships/project-memberships.controller"
import { ProjectMembershipsService } from "./memberships/project-memberships.service"
import { Project } from "./project.entity"
import { ProjectRepository } from "./project.repository"
import { ProjectsController } from "./projects.controller"
import { ProjectsService } from "./projects.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([Project]),
    MembershipsModule,
    OrganizationsModule,
    RbacModule,
    forwardRef(() => AgentsModule),
    forwardRef(() => DocumentTagsModule),
    UsersModule,
    AuthModule,
  ],
  providers: [
    ProjectsService,
    ProjectRepository,
    ProjectMembershipRepository,
    ProjectMembershipsService,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    ProjectMembershipContextResolver,
  ],
  controllers: [ProjectsController, ProjectMembershipsController],
  exports: [
    ProjectsService,
    ProjectMembershipsService,
    ProjectMembershipRepository,
    ProjectRepository,
  ],
})
export class ProjectsModule {}
