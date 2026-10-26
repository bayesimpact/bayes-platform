/**
 * The {{variables}} an agent declares in its instructions.
 *
 * Shared between the API (which substitutes them into the prompt before each
 * model call) and the studio UI (which collects their values at session start
 * and in the embed configuration). Keeping the parse in one place guarantees
 * both sides agree on which variables a prompt declares.
 *
 * A variable is a `{{name}}` placeholder, `name` matching `[A-Za-z0-9_-]+`.
 */

/** A `{{variable}}` placeholder declared in an agent's instructions. */
export const PROMPT_VARIABLE_PLACEHOLDER = /\{\{([A-Za-z0-9_-]+)\}\}/g

/**
 * Names of the variables declared in an agent's instructions, in the order they
 * first appear, without duplicates.
 */
export function extractPromptVariables(instructions: string): string[] {
  const declared: string[] = []
  const seen = new Set<string>()
  for (const match of instructions.matchAll(PROMPT_VARIABLE_PLACEHOLDER)) {
    const name = match[1]
    if (name && !seen.has(name)) {
      seen.add(name)
      declared.push(name)
    }
  }
  return declared
}

/** A supplied value counts: a non-blank string. */
export function hasPromptVariableValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Declared variables that hold no usable value: none in `values` (what the
 * caller supplied) and none in `defaults` (the agent's embed config). A blank
 * string counts as missing.
 */
export function findMissingPromptVariables(
  declared: string[],
  values?: Record<string, string> | null,
  defaults?: Record<string, string> | null,
): string[] {
  return declared.filter(
    (name) => !hasPromptVariableValue(values?.[name]) && !hasPromptVariableValue(defaults?.[name]),
  )
}
