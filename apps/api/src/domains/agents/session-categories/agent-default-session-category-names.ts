/**
 * Comma-separated category labels for the `set-agent-session-categories` CLI when the user opts in
 * to “default” categories. Falls back to {@link FALLBACK_DEFAULT_AGENT_SESSION_CATEGORY_NAMES} when unset.
 */
export const AGENT_DEFAULT_CATEGORIES_ENV = "AGENT_DEFAULT_CATEGORIES"

/** Used when {@link AGENT_DEFAULT_CATEGORIES_ENV} is not set. */
export const FALLBACK_DEFAULT_AGENT_SESSION_CATEGORY_NAMES = [
  "general",
  "support",
  "bug",
  "feature-request",
] as const

export function parseUniqueCommaSeparatedCategoryNames(raw: string): string[] {
  const uniqueNames: string[] = []
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  for (const part of parts) {
    if (!uniqueNames.includes(part)) {
      uniqueNames.push(part)
    }
  }

  return uniqueNames
}

/**
 * Category names offered when the CLI asks to include defaults.
 * If {@link AGENT_DEFAULT_CATEGORIES_ENV} is set (even to an empty string), that value is parsed
 * and used; otherwise the code fallback list applies.
 */
export function resolveConfiguredDefaultAgentSessionCategoryNames(): string[] {
  if (Object.hasOwn(process.env, AGENT_DEFAULT_CATEGORIES_ENV)) {
    const raw = process.env[AGENT_DEFAULT_CATEGORIES_ENV] ?? ""
    return parseUniqueCommaSeparatedCategoryNames(raw)
  }
  return [...FALLBACK_DEFAULT_AGENT_SESSION_CATEGORY_NAMES]
}
