import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ReviewCampaignContextResolver } from "@/common/context/resolvers/review-campaign-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { ReviewCampaignMembershipRepository } from "@/domains/review-campaigns/memberships/review-campaign-membership.repository"
import { ReviewCampaignMembershipsService } from "@/domains/review-campaigns/memberships/review-campaign-memberships.service"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import { UsersModule } from "@/domains/users/users.module"
import { AgentInvitationsController } from "./agent-invitations.controller"
import { Invitation } from "./invitation.entity"
import { InvitationRepository } from "./invitation.repository"
import { InvitationAccessService } from "./invitation-access.service"
import { InvitationsService } from "./invitations.service"
import { MyInvitationsController } from "./my-invitations.controller"
import { ProjectInvitationsController } from "./project-invitations.controller"
import { ReviewCampaignInvitationsController } from "./review-campaign-invitations.controller"

@Module({
  imports: [
    // Project, Agent and ReviewCampaign are read by the context resolvers of the routes.
    TypeOrmModule.forFeature([Invitation, Project, Agent, ReviewCampaign]),
    MembershipsModule,
    UsersModule,
    AuthModule,
    RbacModule,
    OrganizationsModule,
    forwardRef(() => ProjectsModule),
    forwardRef(() => AgentsModule),
  ],
  providers: [
    ReviewCampaignMembershipRepository,
    ReviewCampaignMembershipsService,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    AgentContextResolver,
    ReviewCampaignContextResolver,
    InvitationRepository,
    InvitationAccessService,
    InvitationsService,
  ],
  controllers: [
    ProjectInvitationsController,
    AgentInvitationsController,
    ReviewCampaignInvitationsController,
    MyInvitationsController,
  ],
})
export class InvitationsModule {}
