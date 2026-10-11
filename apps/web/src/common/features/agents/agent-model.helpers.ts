import {
  type AgentModel,
  AgentModelToAgentProvider,
  AgentProvider,
} from "@caseai-connect/api-contracts"
import type {
  AgentModelEntry,
  AgentModelsCatalog,
} from "@/common/features/agents/agent-settings/agent-settings.models"
import type { HasFeature } from "@/common/hooks/use-feature-flags"
import { buildDate } from "@/common/utils/build-date"

/**
 * Models the project may choose from, in catalog order. The API decides what is selectable (a
 * provider behind a feature flag the project lacks is not): `ModelTab` and the eval judge picker
 * both offer this list.
 */
export function buildAgentModelOptions(catalog: AgentModelsCatalog): AgentModel[] {
  return catalog.models.filter((entry) => entry.selectable).map((entry) => entry.model)
}

/**
 * The catalog entry of a model. `agent_settings.model` is an unconstrained string and a model
 * leaves the catalog once its provider retires it, so a stored model may have none.
 */
export function findAgentModelEntry(
  catalog: AgentModelsCatalog | null,
  model: string | undefined,
): AgentModelEntry | undefined {
  return catalog?.models.find((entry) => entry.model === model)
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
 * announces a retirement (banner, sidebar tooltip). Returns `undefined` when the model is
 * supported, unknown, or the catalog is not loaded yet, so callers can use it as their render gate.
 */
export function buildAgentModelDeprecationInterpolation(
  model: AgentModel | undefined,
  catalog: AgentModelsCatalog | null,
) {
  const deprecation = findAgentModelEntry(catalog, model)?.deprecation
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
  catalog: AgentModelsCatalog,
  { deprecatedSuffix, nonEuSuffix }: AgentModelLabelSuffixes,
): string {
  const entry = findAgentModelEntry(catalog, model)
  const suffixes = [
    entry?.deprecation ? deprecatedSuffix : undefined,
    entry?.servedOutsideEu ? nonEuSuffix : undefined,
  ].filter((suffix) => suffix !== undefined)

  return [model, ...suffixes].join(" ")
}

/** The part of a JSON Schema the option fields are read from. */
type OptionsJsonSchema = {
  type?: string
  properties?: Record<string, OptionsJsonSchema>
  enum?: unknown[]
  minimum?: number
  maximum?: number
}

/**
 * The option fields a model offers, read from the JSON Schema of its options: a temperature when
 * it takes one, a thinking level (with the levels it accepts) when it has one. A model may have
 * either, both, or none.
 */
export type ModelOptionFields = {
  temperature?: { minimum?: number; maximum?: number }
  thinkingLevel?: { path: string[]; levels: string[] }
}

export function describeModelOptionFields(entry: AgentModelEntry | undefined): ModelOptionFields {
  const schema = entry?.optionsSchema as OptionsJsonSchema | undefined
  if (!schema) return {}
  const temperature = schema.properties?.temperature
  const thinkingLevel = findThinkingLevel(schema, [])
  return {
    ...(temperature?.type === "number"
      ? { temperature: { minimum: temperature.minimum, maximum: temperature.maximum } }
      : {}),
    ...(thinkingLevel ? { thinkingLevel } : {}),
  }
}

/** The path to the `thinkingLevel` property, wherever the provider nests it, and its levels. */
function findThinkingLevel(
  schema: OptionsJsonSchema,
  path: string[],
): { path: string[]; levels: string[] } | undefined {
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    if (key === "thinkingLevel" && Array.isArray(property.enum))
      return { path: [...path, key], levels: property.enum.map(String) }
    const nested = findThinkingLevel(property, [...path, key])
    if (nested) return nested
  }
  return undefined
}

/** The value at `path` in model options, if any. */
export function readModelOption(options: Record<string, unknown> | null, path: string[]): unknown {
  let value: unknown = options
  for (const key of path) {
    if (typeof value !== "object" || value === null) return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

/** A copy of model options with `value` at `path`. */
export function writeModelOption(
  options: Record<string, unknown> | null,
  path: string[],
  value: unknown,
): Record<string, unknown> {
  const [key, ...rest] = path
  if (key === undefined) return options ?? {}
  const current = options ?? {}
  const child = current[key]
  return {
    ...current,
    [key]:
      rest.length === 0
        ? value
        : writeModelOption(
            typeof child === "object" && child !== null ? (child as Record<string, unknown>) : null,
            rest,
            value,
          ),
  }
}

/** The first value of `key` in model options, wherever the provider nests it (e.g. `thinkingLevel`). */
export function findModelOptionValue(
  options: Record<string, unknown> | null,
  key: string,
): unknown {
  if (!options) return undefined
  if (key in options) return options[key]
  for (const value of Object.values(options)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue
    const found = findModelOptionValue(value as Record<string, unknown>, key)
    if (found !== undefined) return found
  }
  return undefined
}
