import { describe, expect, it } from "vitest"
import {
  fieldsToSchema,
  parseSchemaToFields,
  type SchemaField,
  schemaEnablesOrdering,
} from "./OutputSchemaBuilder"

const field = (overrides: Partial<SchemaField>): SchemaField => ({
  id: overrides.id ?? "id",
  name: overrides.name ?? "",
  type: overrides.type ?? "string",
  description: overrides.description ?? "",
  required: overrides.required ?? false,
  constraints: overrides.constraints ?? {},
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

  it("omits propertyOrdering when ordering is disabled", () => {
    const schema = fieldsToSchema(
      [field({ id: "1", name: "a" }), field({ id: "2", name: "b" })],
      false,
    )
    expect(schema.propertyOrdering).toBeUndefined()
    expect(Object.keys(schema.properties)).toEqual(["a", "b"])
  })

  it("emits a non-empty enum list as a constraint on a string property", () => {
    const schema = fieldsToSchema([
      field({ id: "1", name: "status", constraints: { enum: ["open", "closed"] } }),
    ])
    expect(schema.properties.status).toEqual({ type: "string", enum: ["open", "closed"] })
  })

  it("omits an empty enum list so an in-progress Choice field stays valid", () => {
    const schema = fieldsToSchema([field({ id: "1", name: "status", constraints: { enum: [] } })])
    expect(schema.properties.status).toEqual({ type: "string" })
  })

  it("emits minimum and maximum bounds on a number property", () => {
    const schema = fieldsToSchema([
      field({ id: "1", name: "age", type: "number", constraints: { minimum: 0, maximum: 120 } }),
    ])
    expect(schema.properties.age).toEqual({ type: "number", minimum: 0, maximum: 120 })
  })

  it("emits a single bound when only one is set", () => {
    const schema = fieldsToSchema([
      field({ id: "1", name: "age", type: "number", constraints: { minimum: 18 } }),
    ])
    expect(schema.properties.age).toEqual({ type: "number", minimum: 18 })
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
      { name: "age", type: "number", description: "", required: false, constraints: {} },
      { name: "country", type: "string", description: "Where?", required: true, constraints: {} },
    ])
  })

  it("captures constraint keywords (enum, minimum, maximum, items) into constraints", () => {
    const fields = parseSchemaToFields({
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "closed"] },
        score: { type: "number", minimum: 0, maximum: 10 },
        tags: { type: "array", items: { type: "string" } },
      },
    })

    expect(fields).toEqual([
      {
        name: "status",
        type: "string",
        description: "",
        required: false,
        constraints: { enum: ["open", "closed"] },
      },
      {
        name: "score",
        type: "number",
        description: "",
        required: false,
        constraints: { minimum: 0, maximum: 10 },
      },
      {
        name: "tags",
        type: "array",
        description: "",
        required: false,
        constraints: { items: { type: "string" } },
      },
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

  it("round-trips constraint keywords the builder does not edit", () => {
    const schema = {
      type: "object" as const,
      properties: {
        status: {
          type: "string" as const,
          description: "Current status",
          enum: ["open", "closed"],
        },
        score: { type: "number" as const, minimum: 0, maximum: 10 },
        tags: { type: "array" as const, items: { type: "string" as const } },
      },
      propertyOrdering: ["status", "score", "tags"],
    }
    const withIds = parseSchemaToFields(schema).map((parsed, index) => ({
      ...parsed,
      id: String(index),
    }))
    expect(fieldsToSchema(withIds)).toEqual(schema)
  })
})

describe("schemaEnablesOrdering", () => {
  it("defaults on for fresh or invalid schemas", () => {
    expect(schemaEnablesOrdering("not a schema")).toBe(true)
    expect(schemaEnablesOrdering({ type: "object", properties: {} })).toBe(true)
  })

  it("stays on when the schema already carries propertyOrdering", () => {
    expect(
      schemaEnablesOrdering({
        type: "object",
        properties: { a: { type: "string" }, b: { type: "string" } },
        propertyOrdering: ["a", "b"],
      }),
    ).toBe(true)
  })

  it("starts off for a populated schema without propertyOrdering", () => {
    expect(
      schemaEnablesOrdering({
        type: "object",
        properties: { a: { type: "string" } },
      }),
    ).toBe(false)
  })
})
