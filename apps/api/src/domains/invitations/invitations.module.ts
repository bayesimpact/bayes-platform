import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { InvitationScopeContextResolver } from "@/common/context/resolvers/invitation-scope-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { ReviewCampaignMembershipRepository } from "@/domains/review-campaigns/memberships/review-campaign-membership.repository"
import { ReviewCampaignMembershipsService } from "@/domains/review-campaigns/memberships/review-campaign-memberships.service"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { UsersModule } from "@/domains/users/users.module"
import { Invitation } from "./invitation.entity"
import { InvitationRepository } from "./invitation.repository"
import { InvitationAccessService } from "./invitation-access.service"
import { InvitationsController } from "./invitations.controller"
import { InvitationsGuard } from "./invitations.guard"
import { InvitationsService } from "./invitations.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation, Project, Agent, ReviewCampaign]),
    MembershipsModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => AgentsModule),
  ],
  providers: [
    ReviewCampaignMembershipRepository,
    ReviewCampaignMembershipsService,
    ResourceContextGuard,
    InvitationScopeContextResolver,
    InvitationsGuard,
    InvitationRepository,
    InvitationAccessService,
    InvitationsService,
  ],
  controllers: [InvitationsController],
})
export class InvitationsModule {}
