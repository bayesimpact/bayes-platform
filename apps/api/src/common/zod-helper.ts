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

export function castToolInputParameters(
  input: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const result: Record<string, string | number | boolean | undefined> = {}
  for (const [key, value] of Object.entries(input)) {
    result[key] = castValue(value)
  }
  return result
}

function castValue(value: unknown): string | number | boolean | undefined {
  if (value === null || value === undefined || value === "null") return undefined
  if (typeof value === "boolean" || typeof value === "number") return value
  if (typeof value !== "string") return undefined
  const lower = value.toLowerCase()
  if (lower === "true") return true
  if (lower === "false") return false
  const asNumber = Number(value)
  if (!Number.isNaN(asNumber) && value.trim() !== "") return asNumber
  return value
}
