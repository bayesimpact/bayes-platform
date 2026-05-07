import { outputJsonSchemaSchema } from "@caseai-connect/api-contracts"

describe("outputJsonSchemaSchema", () => {
  it("should accept a flat properties schema (regression for existing schemas)", () => {
    const result = outputJsonSchemaSchema.safeParse({
      type: "object",
      properties: {
        firstName: { type: "string", description: "First name" },
        age: { type: "number" },
      },
      required: ["firstName"],
    })
    expect(result.success).toBe(true)
  })

  it("should accept a schema with if/then/else conditionals", () => {
    const result = outputJsonSchemaSchema.safeParse({
      type: "object",
      properties: {
        claimType: { type: "string", enum: ["medical", "dental"] },
        providerNpi: { type: "string" },
        toothNumber: { type: "number" },
      },
      required: ["claimType"],
      if: { properties: { claimType: { const: "medical" } } },
      // biome-ignore lint/suspicious/noThenProperty: JSON Schema 'then' keyword
      then: { required: ["providerNpi"] },
      else: { required: ["toothNumber"] },
    })
    expect(result.success).toBe(true)
  })

  it("should accept nested object properties", () => {
    const result = outputJsonSchemaSchema.safeParse({
      type: "object",
      properties: {
        address: {
          type: "object",
          properties: {
            street: { type: "string" },
            zip: { type: "string", pattern: "^[0-9]{5}$" },
          },
          required: ["street"],
        },
      },
    })
    expect(result.success).toBe(true)
  })

  it("should accept arrays with items", () => {
    const result = outputJsonSchemaSchema.safeParse({
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" } },
      },
    })
    expect(result.success).toBe(true)
  })

  it("should accept enum and const constraints", () => {
    const result = outputJsonSchemaSchema.safeParse({
      type: "object",
      properties: {
        priority: { type: "string", enum: ["low", "high"] },
        version: { const: 1 },
      },
    })
    expect(result.success).toBe(true)
  })

  it("should reject when a required key is not declared in properties", () => {
    const result = outputJsonSchemaSchema.safeParse({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["age"],
    })
    expect(result.success).toBe(false)
  })

  it("should reject when top-level type is not 'object'", () => {
    const result = outputJsonSchemaSchema.safeParse({
      type: "string",
      properties: {},
    })
    expect(result.success).toBe(false)
  })
})
