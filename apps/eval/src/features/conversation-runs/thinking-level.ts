import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** The names providers give the thinking level in a model's options. */
const THINKING_LEVEL_KEYS = ["thinkingLevel", "reasoningEffort", "effort"]

/** The value under `key` in the options of a model, at any depth. */
function findOption(options: Record<string, unknown>, key: string): unknown {
  if (key in options) return options[key]
  for (const value of Object.values(options)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue
    // Safe: a non-null object that is not an array has string keys.
    const found = findOption(value as Record<string, unknown>, key)
    if (found !== undefined) return found
  }
  return undefined
}

/** The thinking levels the models share, as the app says them. */
const THINKING_LEVEL_LABELS: Record<string, MessageDescriptor> = {
  none: msg({
    message: "None",
    context: "thinking level",
    comment: "A thinking level of a model: it does not think",
  }),
  minimal: msg({ message: "Minimal", comment: "A thinking level of a model" }),
  low: msg({ message: "Low", comment: "A thinking level of a model" }),
  medium: msg({ message: "Medium", comment: "A thinking level of a model" }),
  high: msg({ message: "High", comment: "A thinking level of a model" }),
}

/** The name of a thinking level: none for a level the app does not know, which shows as it is. */
export const thinkingLevelLabelOf = (level: string): MessageDescriptor | null =>
  Object.hasOwn(THINKING_LEVEL_LABELS, level) ? (THINKING_LEVEL_LABELS[level] ?? null) : null

/** The temperature a version of an agent set for its model: `null` when it set none. */
export function temperatureOf(providerOptions: Record<string, unknown>): number | null {
  const value = findOption(providerOptions, "temperature")
  return typeof value === "number" ? value : null
}

/**
 * The thinking level a version of an agent set for its model, whatever name the provider gives
 * it, such as `low` or `high`: `null` when the model has none or the version set none.
 */
export function thinkingLevelOf(providerOptions: Record<string, unknown>): string | null {
  for (const key of THINKING_LEVEL_KEYS) {
    const value = findOption(providerOptions, key)
    if (typeof value === "string") return value
  }
  return null
}
