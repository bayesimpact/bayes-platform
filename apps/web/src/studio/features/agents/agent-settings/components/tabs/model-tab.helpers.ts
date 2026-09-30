import { DEFAULT_EMBEDDING_MODEL, type UpdateAgentSettingsModelDto } from "@caseai-connect/api-contracts"
import type { UseFormReturn } from "react-hook-form"
import { findAgentModelEntry } from "@/common/features/agents/agent-model.helpers"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { AgentModelsCatalog } from "@/common/features/agents/agents.models"
import { pickDirtyFields } from "../agent-tab-form.shared"

/** The default options of a model: what a model starts on when it is picked. */
export function defaultModelOptions(
  catalog: AgentModelsCatalog,
  model: string,
): Record<string, unknown> {
  return findAgentModelEntry(catalog, model)?.defaultOptions ?? {}
}

/**
 * The options the form takes when a model is picked: the agent's own when it goes back to the
 * agent's model, the model's defaults otherwise (the options of another model may not fit).
 */
export function modelOptionsForPickedModel({
  catalog,
  agentSettings,
  model,
}: {
  catalog: AgentModelsCatalog
  agentSettings: Pick<AgentSettings, "model" | "providerOptions">
  model: string
}): Record<string, unknown> {
  return model === agentSettings.model
    ? agentSettings.providerOptions
    : defaultModelOptions(catalog, model)
}

/** The model tab starts from the agent's current model settings. */
export function buildModelTabDefaultValues(
  agentSettings: AgentSettings,
): UpdateAgentSettingsModelDto {
  return {
    model: agentSettings.model,
    providerOptions: agentSettings.providerOptions,
    priorityCallsEnabled: agentSettings.priorityCallsEnabled,
    embeddingModel: agentSettings.embeddingModel ?? DEFAULT_EMBEDDING_MODEL,
  }
}

/**
 * What the model tab saves: the fields the user changed, plus switching the priority tier off
 * when the newly picked model cannot offer it (the toggle is hidden, so the user cannot do it).
 * `resetValues` is what the form shows once saved.
 */
export function buildModelTabSubmit({
  values,
  dirtyFields,
  priorityCallsAvailable,
}: {
  values: UpdateAgentSettingsModelDto
  dirtyFields: UseFormReturn<UpdateAgentSettingsModelDto>["formState"]["dirtyFields"]
  priorityCallsAvailable: boolean
}): { fields: Partial<UpdateAgentSettingsModelDto>; resetValues: UpdateAgentSettingsModelDto } {
  const fields = pickDirtyFields(values, dirtyFields)
  if (!priorityCallsAvailable && values.priorityCallsEnabled) fields.priorityCallsEnabled = false
  return {
    fields,
    resetValues: {
      ...values,
      priorityCallsEnabled: fields.priorityCallsEnabled ?? values.priorityCallsEnabled,
    },
  }
}
