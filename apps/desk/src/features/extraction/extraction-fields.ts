/** One field the agent filled in: its key in the agent's schema, a label and its value. */
export type ExtractedField = { key: string; label: string; value: unknown }

/**
 * A field's key as words, since the Desk does not read the agent's schema:
 * `numberOfParagraphs`, `number_of_paragraphs` and `number-of-paragraphs` read "Number of
 * paragraphs".
 */
export function fieldLabelOf(key: string): string {
  const words = key
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_\-.]+/)
    .filter((word) => word !== "")
    // An acronym keeps its capitals: "PDF url" stays "PDF url".
    .map((word) => (word === word.toUpperCase() && word.length > 1 ? word : word.toLowerCase()))
  const sentence = words.join(" ")
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

/** The fields of a result, in the order the agent wrote them. */
export function extractedFieldsOf(result: Record<string, unknown>): ExtractedField[] {
  return Object.entries(result).map(([key, value]) => ({ key, label: fieldLabelOf(key), value }))
}

/** The keys of every result of a list, in the order they first appear. */
export function fieldKeysOf(results: (Record<string, unknown> | null)[]): string[] {
  const keys = new Set<string>()
  for (const result of results) {
    for (const key of Object.keys(result ?? {})) keys.add(key)
  }
  return [...keys]
}

/** Whether a value holds nothing the agent found: no value, or an empty text or list. */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** A value as plain text, to copy it or to show it in one line. */
export function plainTextOf(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value) && value.every((item) => typeof item !== "object" || item === null)) {
    return value.map((item) => plainTextOf(item)).join(", ")
  }
  return JSON.stringify(value, null, 2)
}

/** A result as the JSON a person downloads or copies. */
export function resultJsonOf(result: Record<string, unknown>): string {
  return `${JSON.stringify(result, null, 2)}\n`
}

/** The name of the JSON file of a result: the document's name, with `.json`. */
export function resultFileNameOf(documentName: string | null): string {
  const base = (documentName ?? "extraction").replace(/\.[^.]+$/, "")
  return `${base}.json`
}
