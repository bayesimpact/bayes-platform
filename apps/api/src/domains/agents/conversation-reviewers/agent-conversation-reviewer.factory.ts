import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import type { Agent } from "@/domains/agents/agent.entity"
import type { User } from "@/domains/users/user.entity"
import type { AgentConversationReviewer } from "./agent-conversation-reviewer.entity"

type AgentConversationReviewerTransientParams = {
  user: User
  agent: Agent
}

export const agentConversationReviewerFactory = Factory.define<
  AgentConversationReviewer,
  AgentConversationReviewerTransientParams
>(({ params, transientParams }) => {
  if (!transientParams.user) throw new Error("user transient is required")
  if (!transientParams.agent) throw new Error("agent transient is required")
  const now = new Date()
  return {
    id: params.id ?? randomUUID(),
    userId: transientParams.user.id,
    agentId: transientParams.agent.id,
    grantedByUserId: params.grantedByUserId ?? null,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
    deletedAt: null,
  } as AgentConversationReviewer
})

/** Grants the safety review of `agent` to `user`. */
export async function grantConversationReview({
  repositories,
  user,
  agent,
}: {
  repositories: AllRepositories
  user: User
  agent: Agent
}): Promise<AgentConversationReviewer> {
  return repositories.agentConversationReviewerRepository.save(
    agentConversationReviewerFactory.transient({ user, agent }).build(),
  )
}
