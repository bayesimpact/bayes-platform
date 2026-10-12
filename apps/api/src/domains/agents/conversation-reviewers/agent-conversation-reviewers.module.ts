import { Module } from "@nestjs/common"
import { AgentConversationReviewerRepository } from "./agent-conversation-reviewer.repository"
import { AgentConversationReviewersService } from "./agent-conversation-reviewers.service"

@Module({
  providers: [AgentConversationReviewerRepository, AgentConversationReviewersService],
  exports: [AgentConversationReviewersService],
})
export class AgentConversationReviewersModule {}
