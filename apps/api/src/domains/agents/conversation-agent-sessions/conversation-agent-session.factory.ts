import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import { v4 } from "uuid"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { User } from "@/domains/users/user.entity"
import type { ConversationAgentSession } from "./conversation-agent-session.entity"

type AgentSessionTransientParams = RequiredScopeTransientParams & {
  agent: Agent
  user: User
}

class ConversationAgentSessionFactory extends Factory<
  ConversationAgentSession,
  AgentSessionTransientParams
> {
  playground() {
    return this.params({ type: "playground" })
  }

  live() {
    return this.params({ type: "live" })
  }

  expiredMinutesAgo(minutes: number) {
    return this.params({ expiresAt: new Date(Date.now() - minutes * 60 * 1000) })
  }
}

export const conversationAgentSessionFactory = ConversationAgentSessionFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }

    if (!transientParams.agent) {
      throw new Error("agent transient is required")
    }
    if (!transientParams.user) {
      throw new Error("user transient is required")
    }

    const now = new Date()
    const defaultExpiresAt =
      params.type === "playground"
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now
        : null

    return {
      id: params.id || randomUUID(),
      agentId: transientParams.agent.id,
      userId: transientParams.user.id,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      type: params.type || "playground",
      title: params.title ?? null,
      parentSessionId: params.parentSessionId ?? null,
      isSubSession: (params.parentSessionId ?? null) !== null,
      expiresAt: params.expiresAt ?? defaultExpiresAt,
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: null,
      agent: transientParams.agent,
      user: transientParams.user,
      organization: transientParams.organization,
      messages: params.messages || [],
      sessionCategories: params.sessionCategories || [],
      traceId: v4(),
      campaignId: params.campaignId ?? null,
      reviewCampaign: null,
    } satisfies ConversationAgentSession
  },
)
