/** A field of the form an agent filled: its label, its type and what was collected. */
export type FormResultField = {
  key: string
  label: string
  type: string | null
  /** The value as a text, or `null` when the agent collected nothing for the field. */
  value: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

function textOf(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null
  if (Array.isArray(value)) return value.map((item) => textOf(item) ?? "").join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

/**
 * The fields of a form's JSON Schema, in its order, with what the agent collected for each. A
 * schema with no property has no field.
 */
export function listFormResultFields(
  schema: Record<string, unknown>,
  value: Record<string, unknown> | null,
): FormResultField[] {
  const properties = isRecord(schema.properties) ? schema.properties : {}
  return Object.entries(properties).map(([key, property]) => {
    const definition = isRecord(property) ? property : {}
    return {
      key,
      label: typeof definition.title === "string" ? definition.title : key,
      type: typeof definition.type === "string" ? definition.type : null,
      value: value && Object.hasOwn(value, key) ? textOf(value[key]) : null,
    }
  })
}
