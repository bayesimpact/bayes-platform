import { describe, expect, it } from "vitest"
import { listFormResultFields } from "./form-result"

describe("listFormResultFields", () => {
  it("lists the schema's fields in order, with what the agent collected", () => {
    const fields = listFormResultFields(
      {
        type: "object",
        properties: {
          title: { type: "string", title: "Title" },
          tags: { type: "array" },
          summary: { type: "string" },
        },
      },
      { title: "Pricing question", tags: ["Product", "Pricing"] },
    )

    expect(fields).toEqual([
      { key: "title", label: "Title", type: "string", value: "Pricing question" },
      { key: "tags", label: "tags", type: "array", value: "Product, Pricing" },
      { key: "summary", label: "summary", type: "string", value: null },
    ])
  })

  it("has no field for a schema with no property", () => {
    expect(listFormResultFields({ type: "object" }, null)).toEqual([])
  })
})
