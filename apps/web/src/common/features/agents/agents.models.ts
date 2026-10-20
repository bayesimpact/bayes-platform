import type {
  AgentModelDto,
  AgentModelListDto,
  AgentWithDraftDto,
} from "@caseai-connect/api-contracts"

export type Agent = AgentWithDraftDto

/** The model catalog as the current project sees it (available or not, with the defaults). */
export type AgentModelsCatalog = AgentModelListDto
/** A model of the catalog: provider, retirement, residency, options. */
export type AgentModelEntry = AgentModelDto
