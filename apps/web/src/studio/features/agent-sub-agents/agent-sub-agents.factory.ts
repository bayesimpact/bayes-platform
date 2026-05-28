import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type { Agent } from "@/common/features/agents/agents.models"
import type { AgentSubAgent } from "./agent-sub-agents.models"

type AgentSubAgentTransientParams = {
  parentAgent: Agent
  childAgent: Agent
}

class AgentSubAgentFactory extends Factory<AgentSubAgent, AgentSubAgentTransientParams> {}

export const agentSubAgentFactory = AgentSubAgentFactory.define(
  ({ params, transientParams }) => {
    const { parentAgent, childAgent } = transientParams
    if (!parentAgent) {
      throw new Error("Parent agent must be provided in transient params to build an AgentSubAgent")
    }
    if (!childAgent) {
      throw new Error("Child agent must be provided in transient params to build an AgentSubAgent")
    }

    return {
      id: params.id ?? faker.string.uuid(),
      parentAgentId: params.parentAgentId ?? parentAgent.id,
      childAgentId: params.childAgentId ?? childAgent.id,
      toolName: params.toolName ?? buildDefaultToolName(childAgent.name),
      description: params.description ?? faker.lorem.sentence(),
      enabled: params.enabled ?? true,
      childAgent: {
        id: params.childAgent?.id ?? childAgent.id,
        name: params.childAgent?.name ?? childAgent.name,
        type: params.childAgent?.type ?? childAgent.type,
      },
      createdAt: params.createdAt ?? faker.date.past().getTime(),
      updatedAt: params.updatedAt ?? faker.date.recent().getTime(),
    }
  },
)

function buildDefaultToolName(agentName: string): string {
  const slug = agentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `ask_${slug || "sub_agent"}`
}
