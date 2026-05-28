import type { AgentSubAgent, ReplaceAgentSubAgent } from "./agent-sub-agents.models"

export interface IAgentSubAgentsSpi {
  getAll(params: {
    organizationId: string
    projectId: string
    agentId: string
  }): Promise<AgentSubAgent[]>
  updateAll(
    params: {
      organizationId: string
      projectId: string
      agentId: string
    },
    payload: { subAgents: ReplaceAgentSubAgent[] },
  ): Promise<AgentSubAgent[]>
}
