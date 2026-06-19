import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import { AuthModule } from "@/domains/auth/auth.module"
import { FeatureFlag } from "@/domains/feature-flags/feature-flag.entity"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
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
      OrganizationMembership,
      ProjectMembership,
      AgentMembership,
      Agent,
    ]),
    UsersModule,
    AuthModule,
  ],
  controllers: [BackofficeController],
  providers: [BackofficeService, BackofficeGuard],
})
export class BackofficeModule {}
