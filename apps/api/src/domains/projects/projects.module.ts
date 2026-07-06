import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ProjectMembershipContextResolver } from "@/common/context/resolvers/project-membership-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { User } from "@/domains/users/user.entity"
import { UsersModule } from "@/domains/users/users.module"
import { AgentsModule } from "../agents/agents.module"
import { DocumentTagsModule } from "../documents/tags/document-tags.module"
import { FeatureFlag } from "../feature-flags/feature-flag.entity"
import { InvitationsModule } from "../invitations/invitations.module"
import { ProjectMembership } from "./memberships/project-membership.entity"
import { ProjectMembershipRepository } from "./memberships/project-membership.repository"
import { ProjectMembershipsController } from "./memberships/project-memberships.controller"
import { ProjectMembershipsService } from "./memberships/project-memberships.service"
import { Project } from "./project.entity"
import { ProjectsController } from "./projects.controller"
import { ProjectsGuard } from "./projects.guard"
import { ProjectsService } from "./projects.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Organization,
      OrganizationMembership,
      ProjectMembership,
      User,
      FeatureFlag,
    ]),
    MembershipsModule,
    OrganizationsModule,
    forwardRef(() => AgentsModule),
    forwardRef(() => InvitationsModule),
    forwardRef(() => DocumentTagsModule),
    UsersModule,
    AuthModule,
  ],
  providers: [
    ProjectsService,
    ProjectMembershipRepository,
    ProjectMembershipsService,
    ProjectsGuard,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    ProjectMembershipContextResolver,
  ],
  controllers: [ProjectsController, ProjectMembershipsController],
  exports: [ProjectsService, ProjectMembershipsService, ProjectMembershipRepository],
})
export class ProjectsModule {}
