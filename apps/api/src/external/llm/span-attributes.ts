/** What a span carries: flat keys, primitive or string array values. */
export type SpanAttributes = Record<string, string | number | string[]>

/** "thinkingLevel" -> "thinking.level". A key of one word passes unchanged. */
export function toDotCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1.$2").toLowerCase()
}

/**
 * Flattens nested metadata into span attributes: the path of each value, in dot case, becomes
 * its key (`{ model: { thinkingLevel: "LOW" } }` -> `{ "model.thinking.level": "LOW" }`).
 * Arrays are values, and null or undefined values are left out.
 */
export function flattenToSpanAttributes(metadata: object, prefix?: string): SpanAttributes {
  const attributes: SpanAttributes = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue
    const path = prefix ? `${prefix}.${toDotCase(key)}` : toDotCase(key)
    if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(attributes, flattenToSpanAttributes(value, path))
    } else {
      attributes[path] = value
    }
  }
  return attributes
}
