import { describe, expect, it } from "vitest"
import { fieldsToSchema, parseSchemaToFields, type SchemaField } from "./FormSchemaBuilder"

const field = (overrides: Partial<SchemaField>): SchemaField => ({
  id: overrides.id ?? "id",
  name: overrides.name ?? "",
  type: overrides.type ?? "string",
  description: overrides.description ?? "",
  required: overrides.required ?? false,
})

describe("fieldsToSchema", () => {
  it("builds properties, propertyOrdering, and required from the ordered field list", () => {
    const schema = fieldsToSchema([
      field({ id: "1", name: "country", description: "Where?", required: true }),
      field({ id: "2", name: "age", type: "number", required: false }),
    ])

    expect(schema).toEqual({
      type: "object",
      properties: {
        country: { type: "string", description: "Where?" },
        age: { type: "number" },
      },
      propertyOrdering: ["country", "age"],
      required: ["country"],
    })
  })

  it("mirrors field order into propertyOrdering", () => {
    const schema = fieldsToSchema([
      field({ id: "1", name: "b" }),
      field({ id: "2", name: "a" }),
      field({ id: "3", name: "c" }),
    ])
    expect(schema.propertyOrdering).toEqual(["b", "a", "c"])
  })

  it("omits the required array when no field is required", () => {
    const schema = fieldsToSchema([field({ id: "1", name: "a" })])
    expect(schema.required).toBeUndefined()
  })

  it("skips blank and duplicate field names", () => {
    const schema = fieldsToSchema([
      field({ id: "1", name: "  " }),
      field({ id: "2", name: "dup" }),
      field({ id: "3", name: "dup", description: "second" }),
    ])
    expect(Object.keys(schema.properties)).toEqual(["dup"])
    expect(schema.propertyOrdering).toEqual(["dup"])
  })
})

describe("parseSchemaToFields", () => {
  it("returns fields in propertyOrdering order with required flags", () => {
    const fields = parseSchemaToFields({
      type: "object",
      properties: {
        country: { type: "string", description: "Where?" },
        age: { type: "number" },
      },
      propertyOrdering: ["age", "country"],
      required: ["country"],
    })

    expect(fields).toEqual([
      { name: "age", type: "number", description: "", required: false },
      { name: "country", type: "string", description: "Where?", required: true },
    ])
  })

  it("returns an empty list for an invalid schema", () => {
    expect(parseSchemaToFields("not a schema")).toEqual([])
    expect(parseSchemaToFields({ type: "array" })).toEqual([])
  })

  it("round-trips through fieldsToSchema", () => {
    const schema = {
      type: "object" as const,
      properties: {
        first: { type: "string" as const, description: "First" },
        second: { type: "boolean" as const },
      },
      propertyOrdering: ["second", "first"],
      required: ["first"],
    }
    const withIds = parseSchemaToFields(schema).map((parsed, index) => ({
      ...parsed,
      id: String(index),
    }))
    expect(fieldsToSchema(withIds)).toEqual(schema)
  })
})
