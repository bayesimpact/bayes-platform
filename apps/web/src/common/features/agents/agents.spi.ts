import type {
  CreateAgentDto,
  DuplicateAgentDto,
  SuccessResponseDTO,
} from "@caseai-connect/api-contracts"
import type { Agent, AgentModelsCatalog } from "./agents.models"

export interface IAgentsSpi {
  getAll: (params: { organizationId: string; projectId: string }) => Promise<Agent[]>
  getAllWithDrafts: (params: { organizationId: string; projectId: string }) => Promise<Agent[]>
  /** The model catalog of the project: what an agent's model and model options may be. */
  getAvailableModels: (params: {
    organizationId: string
    projectId: string
  }) => Promise<AgentModelsCatalog>
  createOne: (
    params: { organizationId: string; projectId: string },
    payload: CreateAgentDto,
  ) => Promise<Agent>
  /** Copies the agent into a new agent of the project, whose settings start as a draft. */
  duplicateOne: (
    params: { organizationId: string; projectId: string; agentId: string },
    payload: DuplicateAgentDto,
  ) => Promise<Agent>
  updateOne: (
    params: { organizationId: string; projectId: string; agentId: string },
    payload: { name: string },
  ) => Promise<SuccessResponseDTO>
  deleteOne: (params: {
    organizationId: string
    projectId: string
    agentId: string
  }) => Promise<SuccessResponseDTO>
}
