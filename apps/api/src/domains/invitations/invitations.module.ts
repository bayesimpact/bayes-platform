import { forwardRef, Global, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { InvitationScopeContextResolver } from "@/common/context/resolvers/invitation-scope-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { ReviewCampaignMembership } from "@/domains/review-campaigns/memberships/review-campaign-membership.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { ReviewCampaignMembershipsService } from "@/domains/review-campaigns/memberships/review-campaign-memberships.service"
import { UsersModule } from "@/domains/users/users.module"
import { LlmModule } from "@/external/llm/llm.module"
import { AgentInvitationHandler } from "./handlers/agent-invitation.handler"
import { InvitationAcceptanceHelpersService } from "./handlers/invitation-acceptance-helpers.service"
import { ProjectInvitationHandler } from "./handlers/project-invitation.handler"
import { ReviewCampaignInvitationHandler } from "./handlers/review-campaign-invitation.handler"
import { Invitation } from "./invitation.entity"
import { InvitationMapper } from "./invitation.mapper"
import { InvitationsController } from "./invitations.controller"
import { InvitationsGuard } from "./invitations.guard"
import { InvitationsService } from "./invitations.service"
import { InvitationsPersistenceModule } from "./invitations-persistence.module"

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invitation,
      Organization,
      Project,
      Agent,
      ReviewCampaign,
      OrganizationMembership,
      ProjectMembership,
      AgentMembership,
      ReviewCampaignMembership,
    ]),
    InvitationsPersistenceModule,
    LlmModule,
    MembershipsModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => AgentsModule),
  ],
  providers: [
    InvitationAcceptanceHelpersService,
    ProjectInvitationHandler,
    AgentInvitationHandler,
    ReviewCampaignInvitationHandler,
    ReviewCampaignMembershipsService,
    ResourceContextGuard,
    InvitationScopeContextResolver,
    InvitationsGuard,
    InvitationsService,
    InvitationMapper,
  ],
  controllers: [InvitationsController],
  exports: [InvitationsService],
})
export class InvitationsModule {}
