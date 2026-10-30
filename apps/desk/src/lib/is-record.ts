/** Whether a value read from JSON is an object of named values, rather than a list or a scalar. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
