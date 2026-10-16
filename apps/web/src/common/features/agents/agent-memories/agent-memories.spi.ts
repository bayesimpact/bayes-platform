import type { SuccessResponseDTO } from "@caseai-connect/api-contracts"
import type {
  AgentMemory,
  AgentMemoryDecision,
  AgentMemorySessionType,
} from "./agent-memories.models"

type AgentMemoriesScope = {
  organizationId: string
  projectId: string
  agentId: string
  sessionType: AgentMemorySessionType
}

/** The caller's own memories with one agent: the API never returns another user's facts. */
export interface IAgentMemoriesSpi {
  getAll(params: AgentMemoriesScope): Promise<AgentMemory[]>
  deleteOne(params: AgentMemoriesScope & { memoryId: string }): Promise<SuccessResponseDTO>
  deleteAll(params: AgentMemoriesScope): Promise<SuccessResponseDTO>
  resolveProposals(
    params: AgentMemoriesScope,
    decisions: AgentMemoryDecision[],
  ): Promise<AgentMemory[]>
}
