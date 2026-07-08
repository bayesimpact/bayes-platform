import type { outputJsonSchemaSchema } from "@caseai-connect/api-contracts"
import { z } from "zod"
import { zNullableType } from "@/common/zod-helper"

export function buildFormFieldsZodSchema(
  properties: z.infer<typeof outputJsonSchemaSchema>["properties"],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, value] of Object.entries(properties)) {
    const description = value.description ?? ""
    switch (value.type) {
      case "string":
        shape[key] = zNullableType(z.string(), description)
        break
      case "number":
        shape[key] = zNullableType(z.number(), description)
        break
      case "boolean":
        shape[key] = zNullableType(z.boolean(), description)
        break
      default:
        throw new Error(`Unsupported form field type: ${value.type}`)
    }
  }
  return z.object(shape).strict()
}
