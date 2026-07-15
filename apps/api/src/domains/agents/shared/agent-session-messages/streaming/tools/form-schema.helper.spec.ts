import {
  getOrderedPropertyEntries,
  type outputJsonSchemaSchema,
  outputJsonSchemaSchema as schema,
} from "@caseai-connect/api-contracts"
import type { z } from "zod"
import { buildFormFieldsZodSchema } from "./form-schema.helper"

type OutputJsonSchema = z.infer<typeof outputJsonSchemaSchema>

const baseSchema: OutputJsonSchema = {
  type: "object",
  properties: {
    country: { type: "string", description: "What country do you live in?" },
    language: { type: "string", description: "What is your preferred language?" },
    age: { type: "number", description: "How old are you?" },
  },
}

describe("getOrderedPropertyEntries", () => {
  it("falls back to properties key order when propertyOrdering is absent", () => {
    expect(getOrderedPropertyEntries(baseSchema).map(([key]) => key)).toEqual([
      "country",
      "language",
      "age",
    ])
  })

  it("orders listed keys first in the given order", () => {
    const ordered = getOrderedPropertyEntries({
      ...baseSchema,
      propertyOrdering: ["language", "age", "country"],
    })
    expect(ordered.map(([key]) => key)).toEqual(["language", "age", "country"])
  })

  it("appends keys missing from propertyOrdering in their original order", () => {
    const ordered = getOrderedPropertyEntries({
      ...baseSchema,
      propertyOrdering: ["age"],
    })
    expect(ordered.map(([key]) => key)).toEqual(["age", "country", "language"])
  })
})

describe("outputJsonSchemaSchema propertyOrdering validation", () => {
  it("accepts a propertyOrdering that references existing properties", () => {
    expect(
      schema.safeParse({ ...baseSchema, propertyOrdering: ["language", "country"] }).success,
    ).toBe(true)
  })

  it("rejects a propertyOrdering that references an unknown property", () => {
    const result = schema.safeParse({ ...baseSchema, propertyOrdering: ["unknown"] })
    expect(result.success).toBe(false)
  })
})

describe("buildFormFieldsZodSchema", () => {
  it("builds the zod shape in propertyOrdering order", () => {
    const zodSchema = buildFormFieldsZodSchema({
      ...baseSchema,
      propertyOrdering: ["language", "country", "age"],
    })
    expect(Object.keys(zodSchema.shape)).toEqual(["language", "country", "age"])
  })

  it("builds the zod shape in properties key order when no ordering is provided", () => {
    const zodSchema = buildFormFieldsZodSchema(baseSchema)
    expect(Object.keys(zodSchema.shape)).toEqual(["country", "language", "age"])
  })
})
