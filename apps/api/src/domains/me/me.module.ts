import { Module } from "@nestjs/common"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AgentConversationReviewersModule } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewers.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { ReviewCampaignsModule } from "@/domains/review-campaigns/review-campaigns.module"
import { AuthModule } from "../auth/auth.module"
import { OrganizationsModule } from "../organizations/organizations.module"
import { ProjectsModule } from "../projects/projects.module"
import { TermsComplianceModule } from "../terms-compliance/terms-compliance.module"
import { UsersModule } from "../users/users.module"
import { MeController } from "./me.controller"
import { MeService } from "./me.service"

@Module({
  imports: [
    UsersModule,
    ProjectsModule,
    OrganizationsModule,
    AgentsModule,
    ReviewCampaignsModule,
    AuthModule,
    TermsComplianceModule,
    RbacModule,
    AgentConversationReviewersModule,
  ],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
