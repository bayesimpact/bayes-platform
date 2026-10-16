import { Factory } from "fishery"
import { v4 } from "uuid"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { User } from "@/domains/users/user.entity"
import type { AgentMemory } from "./agent-memory.entity"

type AgentMemoryTransientParams = RequiredScopeTransientParams & {
  agent: Agent
  user: User
}

class AgentMemoryFactory extends Factory<AgentMemory, AgentMemoryTransientParams> {
  pending() {
    return this.params({ status: "pending", origin: "inferred" })
  }
}

export const agentMemoryFactory = AgentMemoryFactory.define(
  ({ sequence, params, transientParams }) => {
    if (!transientParams.organization) throw new Error("organization transient is required")
    if (!transientParams.project) throw new Error("project transient is required")
    if (!transientParams.agent) throw new Error("agent transient is required")
    if (!transientParams.user) throw new Error("user transient is required")

    const now = new Date()
    return {
      id: params.id ?? v4(),
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      agentId: transientParams.agent.id,
      userId: transientParams.user.id,
      sessionType: params.sessionType ?? "live",
      content: params.content ?? `Prefers short answers (${sequence})`,
      origin: params.origin ?? "user_request",
      status: params.status ?? "saved",
      sourceSessionId: params.sourceSessionId ?? null,
      createdAt: params.createdAt ?? now,
      updatedAt: params.updatedAt ?? now,
      deletedAt: null,
    } satisfies AgentMemory
  },
)
