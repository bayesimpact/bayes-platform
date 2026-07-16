import {
  getOrderedPropertyEntries,
  type OutputJsonSchemaProperty,
  type outputJsonSchemaSchema,
} from "@caseai-connect/api-contracts"
import { z } from "zod"
import { zNullableType } from "@/common/zod-helper"

export function buildFormFieldsZodSchema(
  schema: z.infer<typeof outputJsonSchemaSchema>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, property] of getOrderedPropertyEntries(schema)) {
    shape[key] = buildFieldZodType(property)
  }
  return z.object(shape).strict()
}

// Top-level fields stay lenient/optional so a partial fill-form call never fails validation:
// scalars accept the string form the model sometimes emits (coerced back in castToolInputParameters),
// and array/object fields also accept a raw string or null. Value constraints (enum, minimum,
// maximum) are surfaced to the model through the prompt rather than hard-enforced here, so a
// slightly-off answer is stored and corrected conversationally instead of throwing.
function buildFieldZodType(property: OutputJsonSchemaProperty): z.ZodTypeAny {
  const description = property.description ?? ""
  switch (property.type) {
    case "string":
      return zNullableType(z.string(), description)
    case "number":
      return zNullableType(z.number(), description)
    case "boolean":
      return zNullableType(z.boolean(), description)
    case "array":
      return z
        .union([z.array(buildElementZodType(property.items)), z.string(), z.null()])
        .optional()
        .describe(description)
    case "object":
      return z
        .union([z.record(z.string(), z.unknown()), z.string(), z.null()])
        .optional()
        .describe(description)
  }
}

// Array element types are validated strictly (the SDK enforces them before we ever see the
// value), so no leniency wrapper here. `items` recurses for nested arrays.
function buildElementZodType(items: OutputJsonSchemaProperty | undefined): z.ZodTypeAny {
  switch (items?.type) {
    case "number":
      return z.number()
    case "boolean":
      return z.boolean()
    case "array":
      return z.array(buildElementZodType(items.items))
    case "object":
      return z.record(z.string(), z.unknown())
    default:
      return z.string()
  }
}
