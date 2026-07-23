import type { BaseAgentSessionTypeDto } from "@caseai-connect/api-contracts"
import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import type { ExtractionAgentSession } from "../extraction-agent-sessions/extraction-agent-session.entity"

type AgentSession = ConversationAgentSession | ExtractionAgentSession
export class BaseAgentSessionPolicy extends ProjectScopedPolicy<AgentSession> {
  constructor(
    context: ConstructorParameters<typeof ProjectScopedPolicy>[0],
    entity?: AgentSession,
    private readonly type?: BaseAgentSessionTypeDto,
  ) {
    super(context, entity)
  }

  canList(): boolean {
    if (this.isLive()) {
      return this.canAccess()
    }
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canCreate(): boolean {
    if (this.isLive()) {
      return this.canAccess()
    }
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canDelete(): boolean {
    if (this.isLive()) {
      return this.canAccess() && this.doesResourceBelongToScope()
    }
    return this.canAccess() && this.doesResourceBelongToScope() && this.isProjectAdminOrOwner()
  }

  protected isLive(): boolean {
    return this.type === "live"
  }
}
