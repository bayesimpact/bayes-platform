import { z } from "zod"

export function zNullableType(
  inner: z.ZodString | z.ZodNumber | z.ZodBoolean,
  description: string,
) {
  return z.union([inner, z.string(), z.null()]).optional().describe(description)
}

export function objectToRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return undefined
}

export function castToolInputParameters(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    result[key] = castValue(value)
  }
  return result
}

// Scalar fields are wrapped in a lenient union (see `zNullableType`), so the model can send a
// number as the string "30" or a boolean as "true"; we coerce those back here. Arrays and
// objects (form/extraction fields with `items`) are already validated element-by-element by the
// tool input schema, so they are preserved as-is rather than flattened away.
function castValue(value: unknown): unknown {
  if (value === null || value === undefined || value === "null") return undefined
  if (typeof value === "boolean" || typeof value === "number") return value
  if (Array.isArray(value) || typeof value === "object") return value
  if (typeof value !== "string") return undefined
  const lower = value.toLowerCase()
  if (lower === "true") return true
  if (lower === "false") return false
  const asNumber = Number(value)
  if (!Number.isNaN(asNumber) && value.trim() !== "") return asNumber
  return value
}
