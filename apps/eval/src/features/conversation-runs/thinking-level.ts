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
