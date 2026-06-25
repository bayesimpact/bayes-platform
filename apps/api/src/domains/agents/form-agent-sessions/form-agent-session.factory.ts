import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import { v4 } from "uuid"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { User } from "@/domains/users/user.entity"
import type { FormAgentSession } from "./form-agent-session.entity"

type AgentSessionTransientParams = RequiredScopeTransientParams & {
  agent: Agent
  user: User
}

class FormAgentSessionFactory extends Factory<FormAgentSession, AgentSessionTransientParams> {
  playground() {
    return this.params({ type: "playground" })
  }

  live() {
    return this.params({ type: "live" })
  }
}

export const formAgentSessionFactory = FormAgentSessionFactory.define(
  ({ params, transientParams }) => {
    const now = new Date()

    return {
      id: params.id || randomUUID(),
      agentId: transientParams.agent?.id || params.agentId || "no-agent-id",
      userId: transientParams.user?.id || params.userId || "no-user-id",
      organizationId:
        transientParams.organization?.id || params.organizationId || "no-organization-id",
      projectId: transientParams.project?.id || params.projectId || "no-project-id",
      type: params.type || "playground",
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: null,
      messages: params.messages || [],
      traceId: v4(),
      result: params.result || null,
      parentSessionId: params.parentSessionId ?? null,
      isSubSession: (params.parentSessionId ?? null) !== null,
      campaignId: params.campaignId ?? null,
      reviewCampaign: null,
    } satisfies FormAgentSession
  },
)
