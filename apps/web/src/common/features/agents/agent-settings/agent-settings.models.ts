import type { AgentModelDto, AgentModelsDto, AgentSettingsDto } from "@caseai-connect/api-contracts"

export type AgentSettings = AgentSettingsDto

/** The model catalog as the current project sees it (selectable or not, with the defaults). */
export type AgentModelsCatalog = AgentModelsDto
/** A model of the catalog: provider, retirement, residency, options. */
export type AgentModelEntry = AgentModelDto
