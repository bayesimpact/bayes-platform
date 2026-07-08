import { Factory } from "fishery"
import { v4 } from "uuid"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSubAgent } from "@/domains/agents/sub-agents/agent-sub-agent.entity"

type AgentSubAgentTransientParams = RequiredScopeTransientParams & {
  childAgent: Agent
  parentAgent: Agent
}

class AgentSubAgentFactory extends Factory<AgentSubAgent, AgentSubAgentTransientParams> {
  tool({ toolName, description }: { toolName: string; description: string }) {
    return this.params({ toolName, description })
  }
}

export const agentSubAgentFactory = AgentSubAgentFactory.define(({ params, transientParams }) => {
  if (!transientParams.childAgent) {
    throw new Error("childAgent transient is required")
  }
  if (!transientParams.parentAgent) {
    throw new Error("parentAgent transient is required")
  }
  const now = new Date()

  return {
    id: params.id || v4(),
    createdAt: params.createdAt || now,
    updatedAt: params.updatedAt || now,
    deletedAt: null,
    childAgent: transientParams.childAgent,
    childAgentId: transientParams.childAgent.id,
    parentAgent: transientParams.parentAgent,
    parentAgentId: transientParams.parentAgent.id,
    toolName: params.toolName ?? `ask_${transientParams.childAgent.name}`,
    description: params.description ?? `if necessary, call ask_${transientParams.childAgent.name}`,
    enabled: params.enabled ?? true,
  } satisfies AgentSubAgent
})
