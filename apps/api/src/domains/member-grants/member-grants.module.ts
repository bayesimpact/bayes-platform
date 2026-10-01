import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { MemberGrantScopeContextResolver } from "@/common/context/resolvers/member-grant-scope-context.resolver"
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
import { MemberGrantsController } from "./member-grants.controller"
import { MemberGrantsGuard } from "./member-grants.guard"
import { MemberGrantsService } from "./member-grants.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Agent, ReviewCampaign]),
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
    MemberGrantScopeContextResolver,
    MemberGrantsGuard,
    MemberGrantsService,
  ],
  controllers: [MemberGrantsController],
})
export class MemberGrantsModule {}
