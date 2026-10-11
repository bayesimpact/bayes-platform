import type {
  CreateAgentSettingsDto,
  PartialUpdateAgentSettingsDto,
  SuccessResponseDTO,
} from "@caseai-connect/api-contracts"
import type { AgentModelsCatalog, AgentSettings } from "./agent-settings.models"

type BaseParams = {
  organizationId: string
  projectId: string
  agentId: string
}
export interface IAgentSettingsSpi {
  /** The model catalog of the project: what an agent's model and model options may be. */
  getAvailableModels: (params: {
    organizationId: string
    projectId: string
  }) => Promise<AgentModelsCatalog>
  // History
  getAll: (params: BaseParams) => Promise<AgentSettings[]>
  getFillFormOutputJsonSchema: (
    params: BaseParams & {
      revision: number
    },
  ) => Promise<AgentSettings["outputJsonSchema"] | undefined>
  updateOne: (
    params: BaseParams,
    payload: PartialUpdateAgentSettingsDto,
  ) => Promise<SuccessResponseDTO>
  restoreOne: (
    params: BaseParams & {
      revision: number
    },
  ) => Promise<SuccessResponseDTO>
  createOne: (
    params: BaseParams & {
      revision: number
    },
    payload: CreateAgentSettingsDto,
  ) => Promise<SuccessResponseDTO>
}
