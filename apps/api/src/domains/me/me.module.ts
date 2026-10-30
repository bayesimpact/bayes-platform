import { Module } from "@nestjs/common"
import { AgentConversationReviewersModule } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewers.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { AuthModule } from "../auth/auth.module"
import { OrganizationsModule } from "../organizations/organizations.module"
import { TermsComplianceModule } from "../terms-compliance/terms-compliance.module"
import { UsersModule } from "../users/users.module"
import { MeController } from "./me.controller"

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    AuthModule,
    TermsComplianceModule,
    RbacModule,
    AgentConversationReviewersModule,
  ],
  controllers: [MeController],
})
export class MeModule {}
