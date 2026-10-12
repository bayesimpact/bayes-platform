import { Injectable } from "@nestjs/common"
import type { AgentConversationReviewerRecord } from "./agent-conversation-reviewer.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentConversationReviewerRepository } from "./agent-conversation-reviewer.repository"

/** Who holds `agent_conversation_reviewer` on an agent. Nobody, until granted. */
@Injectable()
export class AgentConversationReviewersService {
  constructor(
    private readonly agentConversationReviewerRepository: AgentConversationReviewerRepository,
  ) {}

  listAgentIdsForUser(userId: string): Promise<string[]> {
    return this.agentConversationReviewerRepository.listAgentIdsForUser(userId)
  }

  listReviewersOfAgent(agentId: string): Promise<AgentConversationReviewerRecord[]> {
    return this.agentConversationReviewerRepository.listReviewersOfAgent(agentId)
  }

  grant(params: { userId: string; agentId: string }): Promise<boolean> {
    return this.agentConversationReviewerRepository.grant(params)
  }

  revoke(params: { userId: string; agentId: string }): Promise<boolean> {
    return this.agentConversationReviewerRepository.revoke(params)
  }
}
