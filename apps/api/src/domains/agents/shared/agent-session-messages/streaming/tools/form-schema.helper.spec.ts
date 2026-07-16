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

describe("outputJsonSchemaSchema constraint keywords", () => {
  it("accepts and preserves enum, minimum, maximum, and items", () => {
    const result = schema.safeParse({
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "closed"] },
        age: { type: "number", minimum: 0, maximum: 120 },
        tags: { type: "array", items: { type: "string", enum: ["a", "b"] } },
      },
    })
    expect(result.success).toBe(true)
    expect(result.data?.properties.status?.enum).toEqual(["open", "closed"])
    expect(result.data?.properties.age).toMatchObject({ minimum: 0, maximum: 120 })
    expect(result.data?.properties.tags?.items).toEqual({ type: "string", enum: ["a", "b"] })
  })

  it("rejects an empty enum", () => {
    const result = schema.safeParse({
      type: "object",
      properties: { status: { type: "string", enum: [] } },
    })
    expect(result.success).toBe(false)
  })

  it("rejects a minimum greater than the maximum", () => {
    const result = schema.safeParse({
      type: "object",
      properties: { age: { type: "number", minimum: 10, maximum: 5 } },
    })
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

  it("builds fields for array and object types without throwing", () => {
    const zodSchema = buildFormFieldsZodSchema({
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" } },
        scores: { type: "array", items: { type: "number" } },
        metadata: { type: "object" },
      },
    })
    expect(Object.keys(zodSchema.shape)).toEqual(["tags", "scores", "metadata"])
  })

  it("accepts array and object values on the built schema", () => {
    const zodSchema = buildFormFieldsZodSchema({
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" } },
        scores: { type: "array", items: { type: "number" } },
        metadata: { type: "object" },
      },
    })
    const parsed = zodSchema.parse({
      tags: ["a", "b"],
      scores: [1, 2, 3],
      metadata: { source: "import" },
    })
    expect(parsed).toEqual({
      tags: ["a", "b"],
      scores: [1, 2, 3],
      metadata: { source: "import" },
    })
  })

  it("rejects an array element that violates the element type", () => {
    const zodSchema = buildFormFieldsZodSchema({
      type: "object",
      properties: { scores: { type: "array", items: { type: "number" } } },
    })
    // An array whose elements are the wrong type falls through every union branch.
    expect(zodSchema.safeParse({ scores: [{ nested: true }] }).success).toBe(false)
  })
})
