import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentSessionInCampaignContextResolver } from "@/common/context/resolvers/agent-session-in-campaign-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ReviewCampaignContextResolver } from "@/common/context/resolvers/review-campaign-context.resolver"
import { ReviewCampaignMembershipContextResolver } from "@/common/context/resolvers/review-campaign-membership-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentsModule } from "@/domains/agents/agents.module"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { AuthModule } from "@/domains/auth/auth.module"
import { InvitationsModule } from "@/domains/invitations/invitations.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { User } from "@/domains/users/user.entity"
import { UsersModule } from "@/domains/users/users.module"
import { ReviewCampaignMembershipRepository } from "./memberships/review-campaign-membership.repository"
import { ReviewCampaignMembershipsService } from "./memberships/review-campaign-memberships.service"
import { CampaignReportGuard } from "./reports/campaign-report.guard"
import { ReportsController } from "./reports/reports.controller"
import { ReportsService } from "./reports/reports.service"
import { ReviewCampaign } from "./review-campaign.entity"
import { ReviewCampaignRepository } from "./review-campaign.repository"
import { ReviewCampaignsController } from "./review-campaigns.controller"
import { ReviewCampaignsGuard } from "./review-campaigns.guard"
import { ReviewCampaignsService } from "./review-campaigns.service"
import { ReviewerSessionReviewController } from "./reviewer/reviewer.controller"
import { ReviewerGuard } from "./reviewer/reviewer.guard"
import { ReviewerService } from "./reviewer/reviewer.service"
import { ReviewerSessionDetailController } from "./reviewer/reviewer-session-detail.controller"
import { ReviewerSessionsController } from "./reviewer/reviewer-sessions.controller"
import { ReviewerSessionReview } from "./reviewer-session-reviews/reviewer-session-review.entity"
import {
  TesterController,
  TesterMeController,
  TesterSessionFeedbackController,
} from "./tester/tester.controller"
import { TesterGuard } from "./tester/tester.guard"
import { TesterService } from "./tester/tester.service"
import { TesterCampaignSurvey } from "./tester-campaign-surveys/tester-campaign-survey.entity"
import { TesterSessionFeedback } from "./tester-session-feedbacks/tester-session-feedback.entity"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      AgentSettings,
      AgentMessage,
      ConversationAgentSession,
      ExtractionAgentSession,
      Organization,
      Project,
      ReviewCampaign,
      ReviewerSessionReview,
      TesterCampaignSurvey,
      TesterSessionFeedback,
      User,
    ]),
    OrganizationsModule,
    ProjectsModule,
    MembershipsModule,
    AgentsModule,
    forwardRef(() => InvitationsModule),
    UsersModule,
    AuthModule,
    forwardRef(() => ConversationAgentSessionsModule),
  ],
  providers: [
    AgentSessionInCampaignContextResolver,
    AgentSettingsService,
    CampaignReportGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    ReportsService,
    ResourceContextGuard,
    ReviewCampaignContextResolver,
    ReviewCampaignMembershipContextResolver,
    ReviewCampaignMembershipRepository,
    ReviewCampaignMembershipsService,
    ReviewCampaignRepository,
    ReviewCampaignsGuard,
    ReviewCampaignsService,
    ReviewerGuard,
    ReviewerService,
    TesterGuard,
    TesterService,
  ],
  controllers: [
    ReportsController,
    ReviewCampaignsController,
    ReviewerSessionDetailController,
    ReviewerSessionReviewController,
    ReviewerSessionsController,
    TesterController,
    TesterMeController,
    TesterSessionFeedbackController,
  ],
  exports: [
    ReportsService,
    ReviewCampaignsService,
    ReviewCampaignRepository,
    ReviewCampaignMembershipRepository,
    ReviewCampaignMembershipsService,
    ReviewerService,
    TesterService,
  ],
})
export class ReviewCampaignsModule {}
