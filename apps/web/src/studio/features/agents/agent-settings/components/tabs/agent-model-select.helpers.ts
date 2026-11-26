import {
  type AgentModel,
  AgentModelDisplayNames,
  AgentProviderVendors,
} from "@bayes-platform/api-contracts"
import {
  describeModelOptionFields,
  findAgentModelEntry,
} from "@/common/features/agents/agent-model.helpers"
import type { AgentModelsCatalog } from "@/common/features/agents/agents.models"
import type { AgentModelOption, AgentModelTag } from "./AgentModelSelect"

/** The value of an added model in the select: its platform model is read from the catalog. */
const CUSTOM_MODEL_VALUE_PREFIX = "custom:"

export type AgentModelChoice = { model: AgentModel; customModelId: string | null }

export function toAgentModelSelectValue({ model, customModelId }: AgentModelChoice): string {
  return customModelId ? `${CUSTOM_MODEL_VALUE_PREFIX}${customModelId}` : model
}

/** The model and added model a select value stands for. Unknown added models give null. */
export function fromAgentModelSelectValue(
  catalog: AgentModelsCatalog,
  value: string,
): AgentModelChoice | null {
  if (!value.startsWith(CUSTOM_MODEL_VALUE_PREFIX)) {
    return { model: value as AgentModel, customModelId: null }
  }
  const customModelId = value.slice(CUSTOM_MODEL_VALUE_PREFIX.length)
  const customModel = catalog.customModels.find((candidate) => candidate.id === customModelId)
  return customModel ? { model: customModel.baseModel, customModelId } : null
}

/**
 * The lines of the model select: the platform models the workspace offers, grouped by vendor,
 * then the models the workspace added. The agent's current model stays listed, disabled, once the
 * workspace no longer offers it.
 */
export function buildAgentModelSelectOptions({
  catalog,
  current,
  priorityCallsModel,
  addedModelsGroup,
  formatDate,
}: {
  catalog: AgentModelsCatalog
  current: AgentModelChoice
  /** The platform model the agent calls with the priority tier, or null when it is off. */
  priorityCallsModel: string | null
  addedModelsGroup: string
  formatDate: (isoDate: string) => string
}): AgentModelOption[] {
  const codeModels = catalog.models
    .filter(
      (entry) =>
        entry.isAvailable || (current.customModelId === null && entry.model === current.model),
    )
    .map((entry): AgentModelOption => {
      const tags: AgentModelTag[] = []
      if (entry.model === catalog.defaults.agent) tags.push("recommended")
      if (entry.servedOutsideEu) tags.push("outsideEu")
      if (entry.selfHosted) tags.push("selfHosted")
      if (entry.model === priorityCallsModel) tags.push("priority")
      if (describeModelOptionFields(entry).thinkingLevel) tags.push("reasoning")
      return {
        value: entry.model,
        name: AgentModelDisplayNames[entry.model] ?? entry.model,
        modelId: entry.model,
        group: AgentProviderVendors[entry.provider] ?? entry.provider,
        tags,
        retirement: entry.deprecation
          ? {
              date: formatDate(entry.deprecation.deprecatedOn),
              past: entry.deprecation.deprecatedOn < new Date().toISOString().slice(0, 10),
              replacement:
                AgentModelDisplayNames[entry.deprecation.recommendedReplacement] ??
                entry.deprecation.recommendedReplacement,
            }
          : undefined,
        disabled: !entry.isAvailable,
      }
    })
  const vendorOrder = [...new Set(codeModels.map((option) => option.group))]
  codeModels.sort(
    (first, second) => vendorOrder.indexOf(first.group) - vendorOrder.indexOf(second.group),
  )

  const addedModels = catalog.customModels.map(
    (customModel): AgentModelOption => ({
      value: toAgentModelSelectValue({
        model: customModel.baseModel,
        customModelId: customModel.id,
      }),
      name: customModel.name,
      modelId: customModel.baseModel,
      group: addedModelsGroup,
      tags: ["selfHosted"],
    }),
  )
  return [...codeModels, ...addedModels]
}

/** Whether the catalog still offers the agent's choice. */
export function isAgentModelChoiceAvailable(
  catalog: AgentModelsCatalog,
  choice: AgentModelChoice,
): boolean {
  if (choice.customModelId)
    return catalog.customModels.some((customModel) => customModel.id === choice.customModelId)
  return findAgentModelEntry(catalog, choice.model)?.isAvailable === true
}

/** Lower case, without accents, so "génération" matches "generation". */
function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

/**
 * The options that match a search: each word of the search must appear in the name, the
 * technical id or the group of the option. An empty search keeps every option.
 */
export function filterAgentModelOptions(
  options: AgentModelOption[],
  search: string,
): AgentModelOption[] {
  const words = normalizeForSearch(search).split(/\s+/).filter(Boolean)
  if (words.length === 0) return options
  return options.filter((option) => {
    const text = normalizeForSearch(`${option.name} ${option.modelId} ${option.group}`)
    return words.every((word) => text.includes(word))
  })
}
