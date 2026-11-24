import { Module } from "@nestjs/common"
import { EvaluationContextModule } from "@/common/context/evaluation-context.module"
import { ResourceContextModule } from "@/common/context/resource-context.module"
import { AgentsModule } from "@/domains/agents/agents.module"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { EvaluationsModule } from "@/domains/evaluations/evaluations.module"
import { InvitationsModule } from "@/domains/invitations/invitations.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { ReviewCampaignsModule } from "@/domains/review-campaigns/review-campaigns.module"
import { UsersModule } from "@/domains/users/users.module"
import { EvalAccountController } from "./account/account.controller"
import { EvalAgentsController } from "./agents/agents.controller"
import { EvalDocumentsController } from "./documents/documents.controller"
import { EvalConversationDatasetsController } from "./evaluations/conversation/datasets/datasets.controller"
import { EvalConversationRunsController } from "./evaluations/conversation/runs/runs.controller"
import { EvalExtractionDatasetsController } from "./evaluations/extraction/datasets/datasets.controller"
import { EvalExtractionRunsController } from "./evaluations/extraction/runs/runs.controller"
import { EvalInvitationsController } from "./invitations/invitations.controller"
import { EvalOrganizationsController } from "./organizations/organizations.controller"
import { EvalProjectsController } from "./projects/projects.controller"
import { EvalCampaignInvitationsController } from "./review-campaigns/campaigns/campaign-invitations.controller"
import { EvalReviewCampaignsController } from "./review-campaigns/campaigns/campaigns.controller"
import { EvalMyReviewCampaignsController } from "./review-campaigns/campaigns/my-campaigns.controller"
import { EvalReviewerController } from "./review-campaigns/reviewer/reviewer.controller"

/**
 * The evaluation app's own API: the routes of `@caseai-connect/eval-contracts`, each checked with
 * the schemas of its route. Each handler copies the logic of the endpoint the app called before.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    RbacModule,
    ResourceContextModule,
    EvaluationContextModule,
    InvitationsModule,
    OrganizationsModule,
    ProjectsModule,
    AgentsModule,
    ConversationAgentSessionsModule,
    StorageModule,
    EvaluationsModule,
    ReviewCampaignsModule,
  ],
  controllers: [
    EvalAccountController,
    EvalInvitationsController,
    EvalOrganizationsController,
    EvalProjectsController,
    EvalAgentsController,
    EvalDocumentsController,
    EvalConversationDatasetsController,
    EvalConversationRunsController,
    EvalExtractionDatasetsController,
    EvalExtractionRunsController,
    EvalReviewCampaignsController,
    EvalMyReviewCampaignsController,
    EvalCampaignInvitationsController,
    EvalReviewerController,
  ],
})
export class EvalModule {}
