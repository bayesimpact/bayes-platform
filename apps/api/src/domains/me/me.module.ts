import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import { ReviewCampaignMembership } from "@/domains/review-campaigns/memberships/review-campaign-membership.entity"
import { AuthModule } from "../auth/auth.module"
import { OrganizationMembership } from "../organizations/memberships/organization-membership.entity"
import { OrganizationsModule } from "../organizations/organizations.module"
import { ProjectMembership } from "../projects/memberships/project-membership.entity"
import { ProjectsModule } from "../projects/projects.module"
import { TermsComplianceModule } from "../terms-compliance/terms-compliance.module"
import { UsersModule } from "../users/users.module"
import { MeController } from "./me.controller"
import { MeService } from "./me.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationMembership,
      ProjectMembership,
      AgentMembership,
      ReviewCampaignMembership,
    ]),
    UsersModule,
    ProjectsModule,
    OrganizationsModule,
    AuthModule,
    TermsComplianceModule,
  ],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
