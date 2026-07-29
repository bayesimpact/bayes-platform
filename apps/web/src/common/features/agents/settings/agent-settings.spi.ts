import type { UpdateAgentSettingsDto } from "@caseai-connect/api-contracts"
import type { AgentSettings } from "./agent-settings.models"

type AgentParams = { organizationId: string; projectId: string; agentId: string }

export interface IAgentSettingsSpi {
  getAll: (params: AgentParams) => Promise<AgentSettings[]>
  updateOne: (params: AgentParams, payload: UpdateAgentSettingsDto) => Promise<AgentSettings>
  publishOne: (
    params: AgentParams & { revision: number },
    payload: { revisionName?: string | null; revisionDesc?: string | null },
  ) => Promise<AgentSettings>
  archiveOne: (params: AgentParams & { revision: number }) => Promise<void>
  restoreOne: (params: AgentParams & { revision: number }) => Promise<void>
}
