import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ReviewCampaignContextResolver } from "@/common/context/resolvers/review-campaign-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentsModule } from "@/domains/agents/agents.module"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { AgentSettingsModule } from "@/domains/agents/settings/agent-settings.module"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { ConversationFormsModule } from "@/domains/agents/shared/conversation-forms/conversation-forms.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { User } from "@/domains/users/user.entity"
import { UsersModule } from "@/domains/users/users.module"
import { ReviewCampaignMembershipRepository } from "./memberships/review-campaign-membership.repository"
import { ReviewCampaignMembershipsService } from "./memberships/review-campaign-memberships.service"
import { ReportsService } from "./reports/reports.service"
import { ReviewCampaign } from "./review-campaign.entity"
import { ReviewCampaignRepository } from "./review-campaign.repository"
import { ReviewCampaignsController } from "./review-campaigns.controller"
import { ReviewCampaignsService } from "./review-campaigns.service"
import { ReviewerService } from "./reviewer/reviewer.service"
import { ReviewerSessionReview } from "./reviewer-session-reviews/reviewer-session-review.entity"
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

    AgentsModule,
    forwardRef(() => AgentSettingsModule),
    UsersModule,
    AuthModule,
    forwardRef(() => ConversationAgentSessionsModule),
    ConversationFormsModule,
    RbacModule,
  ],
  providers: [
    OrganizationContextResolver,
    ProjectContextResolver,
    ReportsService,
    ResourceContextGuard,
    ReviewCampaignContextResolver,
    ReviewCampaignMembershipRepository,
    ReviewCampaignMembershipsService,
    ReviewCampaignRepository,
    ReviewCampaignsService,
    ReviewerService,
    TesterService,
  ],
  // Evaluation serves the campaign routes from `src/domains/eval/`. This one serves the Studio.
  controllers: [ReviewCampaignsController],
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
