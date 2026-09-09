import {
  AgentModel,
  AgentModelToAgentProvider,
  AgentProvider,
  getAgentModelDeprecation,
  isAgentModelServedOutsideEu,
} from "@caseai-connect/api-contracts"
import type { HasFeature } from "@/common/hooks/use-feature-flags"
import { buildDate } from "@/common/utils/build-date"

/**
 * Models a project may choose from, in enum declaration order.
 *
 * Single source of truth for provider gating: `AgentModelTab` and the eval judge picker both
 * call this, so a new provider or a new gate is one change here.
 */
export function buildAgentModelOptions(hasFeature: HasFeature): AgentModel[] {
  const providers: AgentProvider[] = [
    // Vertex3 is never gated: it holds the recommended replacements for the deprecated Vertex
    // models, so hiding it would leave a project unable to migrate off them.
    AgentProvider.Vertex,
    AgentProvider.Vertex3,
  ]
  if (hasFeature("medgemma")) providers.push(AgentProvider.MedGemma)
  if (hasFeature("gemma")) providers.push(AgentProvider.Gemma)
  if (hasFeature("mistral")) providers.push(AgentProvider.Mistral)

  // AgentModel._Mock drops out naturally — its provider is never in the list.
  return Object.values(AgentModel).filter((model) =>
    providers.includes(AgentModelToAgentProvider[model]),
  )
}

/**
 * Whether the priority service tier can be offered for `model`: the project must hold the
 * `llm-priority-calls` flag and the model must be a Gemini 3.x one (the only provider with tiers).
 * The API enforces the same rule; this only decides whether to show the toggle.
 */
export function isPriorityCallsAvailable({
  hasFeature,
  model,
}: {
  hasFeature: HasFeature
  model: AgentModel | undefined
}): boolean {
  if (!hasFeature("llm-priority-calls")) return false
  return model !== undefined && AgentModelToAgentProvider[model] === AgentProvider.Vertex3
}

/**
 * Interpolation values for the `agent:model.deprecation.*` strings, shared by every surface that
 * announces a retirement (banner, sidebar tooltip). Returns `undefined` when the model is supported
 * or unknown, so callers can use it as their render gate.
 */
export function buildAgentModelDeprecationInterpolation(model: AgentModel | undefined) {
  const deprecation = model ? getAgentModelDeprecation(model) : undefined
  if (!deprecation) return undefined

  return {
    model,
    replacement: deprecation.recommendedReplacement,
    // `new Date("2026-09-30")` parses as UTC midnight, which formats as 29 September in any
    // negative-offset timezone. Appending the time forces local-midnight parsing instead.
    date: buildDate(new Date(`${deprecation.deprecatedOn}T00:00:00`).getTime(), "dd MMMM yyyy"),
  }
}

/** Already-translated suffixes a model label can carry. Both can apply to the same model. */
export type AgentModelLabelSuffixes = {
  deprecatedSuffix: string
  nonEuSuffix: string
}

/**
 * Option label for a model in a select: the model id plus whichever catalog facts apply, in the
 * order urgency dictates (retirement first, residency second). Pass the already-translated
 * suffixes so this stays a pure function.
 */
export function formatAgentModelLabel(
  model: AgentModel,
  { deprecatedSuffix, nonEuSuffix }: AgentModelLabelSuffixes,
): string {
  const suffixes = [
    getAgentModelDeprecation(model) ? deprecatedSuffix : undefined,
    isAgentModelServedOutsideEu(model) ? nonEuSuffix : undefined,
  ].filter((suffix) => suffix !== undefined)

  return [model, ...suffixes].join(" ")
}
