import type { UpdateAgentSettingsModelDto } from "@caseai-connect/api-contracts"
import type { UseFormReturn } from "react-hook-form"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import { pickDirtyFields } from "../agent-tab-form.shared"

/** The model tab starts from the agent's current model settings. */
export function buildModelTabDefaultValues(
  agentSettings: AgentSettings,
): UpdateAgentSettingsModelDto {
  return {
    model: agentSettings.model,
    deletedTemperature: agentSettings.deletedTemperature,
    priorityCallsEnabled: agentSettings.priorityCallsEnabled,
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
