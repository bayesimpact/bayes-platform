import type { AgentEmbedConfig } from "./agent-embed-configs.models"

export interface IAgentEmbedConfigsSpi {
  getOne: (params: {
    organizationId: string
    projectId: string
    agentId: string
  }) => Promise<AgentEmbedConfig>
  updateOne: (
    params: { organizationId: string; projectId: string; agentId: string },
    payload: { isEnabled?: boolean; allowedOrigins?: string[] },
  ) => Promise<void>
}
