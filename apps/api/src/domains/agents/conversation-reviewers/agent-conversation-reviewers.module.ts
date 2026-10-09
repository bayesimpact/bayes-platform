import { Module } from "@nestjs/common"
import { AgentConversationReviewerGuard } from "./agent-conversation-reviewer.guard"
import { AgentConversationReviewerRepository } from "./agent-conversation-reviewer.repository"
import { AgentConversationReviewersService } from "./agent-conversation-reviewers.service"

@Module({
  providers: [
    AgentConversationReviewerRepository,
    AgentConversationReviewersService,
    AgentConversationReviewerGuard,
  ],
  exports: [AgentConversationReviewersService, AgentConversationReviewerGuard],
})
export class AgentConversationReviewersModule {}
