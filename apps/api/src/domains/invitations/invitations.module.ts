import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { MailerModule } from "@/common/mailer/mailer.module"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { ReviewCampaignMembershipRepository } from "@/domains/review-campaigns/memberships/review-campaign-membership.repository"
import { ReviewCampaignMembershipsService } from "@/domains/review-campaigns/memberships/review-campaign-memberships.service"
import { UsersModule } from "@/domains/users/users.module"
import { AgentInvitationsController } from "./agent-invitations.controller"
import { Invitation } from "./invitation.entity"
import { InvitationRepository } from "./invitation.repository"
import { InvitationAccessService } from "./invitation-access.service"
import { InvitationsService } from "./invitations.service"
import { MyInvitationsController } from "./my-invitations.controller"
import { ProjectInvitationsController } from "./project-invitations.controller"

@Module({
  imports: [
    // Project and Agent are read by the context resolvers of the routes.
    TypeOrmModule.forFeature([Invitation, Project, Agent]),
    MailerModule,

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
    InvitationRepository,
    InvitationAccessService,
    InvitationsService,
  ],
  controllers: [ProjectInvitationsController, AgentInvitationsController, MyInvitationsController],
  exports: [InvitationsService],
})
export class InvitationsModule {}
