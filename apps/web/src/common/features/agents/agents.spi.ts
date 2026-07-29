import type {
  CreateAgentDto,
  UpdateAgentDocumentTagsDto,
  UpdateAgentNameDto,
  UpdateAgentResourceLibrariesDto,
  UpdateAgentSessionCategoriesDto,
} from "@caseai-connect/api-contracts"
import type { Agent } from "./agents.models"

export interface IAgentsSpi {
  getAll: (params: { organizationId: string; projectId: string }) => Promise<Agent[]>
  createOne: (
    params: { organizationId: string; projectId: string },
    payload: CreateAgentDto,
  ) => Promise<Agent>
  updateOne: (
    params: { organizationId: string; projectId: string; agentId: string },
    payload: UpdateAgentNameDto,
  ) => Promise<void>
  updateDocumentTags: (
    params: { organizationId: string; projectId: string; agentId: string },
    payload: UpdateAgentDocumentTagsDto,
  ) => Promise<void>
  updateResourceLibraries: (
    params: { organizationId: string; projectId: string; agentId: string },
    payload: UpdateAgentResourceLibrariesDto,
  ) => Promise<void>
  updateSessionCategories: (
    params: { organizationId: string; projectId: string; agentId: string },
    payload: UpdateAgentSessionCategoriesDto,
  ) => Promise<void>
  deleteOne: (params: {
    organizationId: string
    projectId: string
    agentId: string
  }) => Promise<void>
}
