import { flattenToSpanAttributes, toDotCase } from "@/external/llm/span-attributes"

describe("toDotCase", () => {
  it.each([
    ["thinkingLevel", "thinking.level"],
    ["agentParentTrace", "agent.parent.trace"],
    ["environment", "environment"],
    ["gemini35Flash", "gemini35.flash"],
  ])("turns %s into %s", (key, expected) => {
    expect(toDotCase(key)).toBe(expected)
  })
})

describe("flattenToSpanAttributes", () => {
  it("joins the path of each value in dot case", () => {
    expect(
      flattenToSpanAttributes({
        provider: { name: "vertex3", project: "project-1" },
        model: { name: "gemini-3.5-flash", thinkingLevel: "LOW" },
        agent: { type: "Helpful Assistant", parent: { trace: "trace-1" } },
        environment: "**TEST**",
      }),
    ).toEqual({
      "provider.name": "vertex3",
      "provider.project": "project-1",
      "model.name": "gemini-3.5-flash",
      "model.thinking.level": "LOW",
      "agent.type": "Helpful Assistant",
      "agent.parent.trace": "trace-1",
      environment: "**TEST**",
    })
  })

  it("keeps arrays and numbers as values", () => {
    expect(
      flattenToSpanAttributes({ agent: { revision: 3 }, tool: { names: ["a", "b"] } }),
    ).toEqual({ "agent.revision": 3, "tool.names": ["a", "b"] })
  })

  it("leaves out null and undefined values, and empty objects", () => {
    expect(
      flattenToSpanAttributes({ model: { name: "model-1", serviceTier: undefined }, tool: {} }),
    ).toEqual({ "model.name": "model-1" })
  })

  it("prefixes every key when given a prefix", () => {
    expect(flattenToSpanAttributes({ name: "vertex3" }, "provider")).toEqual({
      "provider.name": "vertex3",
    })
  })
})
