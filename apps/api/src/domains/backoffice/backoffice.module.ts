import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentRepository } from "@/domains/agents/agent.repository"
import { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import { AgentMembershipRepository } from "@/domains/agents/memberships/agent-membership.repository"
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import { AuthModule } from "@/domains/auth/auth.module"
import { FeatureFlag } from "@/domains/feature-flags/feature-flag.entity"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { OrganizationMembershipRepository } from "@/domains/organizations/memberships/organization-membership.repository"
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import { Organization } from "@/domains/organizations/organization.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { ProjectMembershipRepository } from "@/domains/projects/memberships/project-membership.repository"
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import { Project } from "@/domains/projects/project.entity"
import { User } from "@/domains/users/user.entity"
import { UsersModule } from "@/domains/users/users.module"
import { BackofficeController } from "./backoffice.controller"
import { BackofficeGuard } from "./backoffice.guard"
import { BackofficeService } from "./backoffice.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Project,
      FeatureFlag,
      User,
      Agent,
      OrganizationMembership,
      ProjectMembership,
      AgentMembership,
    ]),
    MembershipsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [BackofficeController],
  providers: [
    BackofficeService,
    BackofficeGuard,
    OrganizationMembershipRepository,
    OrganizationMembershipsService,
    ProjectMembershipRepository,
    ProjectMembershipsService,
    AgentMembershipRepository,
    AgentMembershipsService,
    AgentRepository,
  ],
})
export class BackofficeModule {}
