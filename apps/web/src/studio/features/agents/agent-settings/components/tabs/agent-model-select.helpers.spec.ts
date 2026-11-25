import { describe, expect, it } from "vitest"
import type { AgentModelOption } from "./AgentModelSelect"
import { filterAgentModelOptions } from "./agent-model-select.helpers"

const option = (overrides: Partial<AgentModelOption>): AgentModelOption => ({
  value: "model",
  name: "Model",
  modelId: "model",
  group: "Vendor",
  tags: [],
  ...overrides,
})

const options = [
  option({
    value: "flash",
    name: "Gemini 3.5 Flash",
    modelId: "gemini-3.5-flash",
    group: "Google",
  }),
  option({
    value: "sonnet",
    name: "Claude Sonnet 5.5",
    modelId: "claude-sonnet-5-5",
    group: "Anthropic",
  }),
  option({
    value: "custom:qwen",
    name: "Qwen test",
    modelId: "qwen-3.8-27b",
    group: "Modèles de ce workspace",
  }),
]

const values = (search: string) =>
  filterAgentModelOptions(options, search).map((matching) => matching.value)

describe("filterAgentModelOptions", () => {
  it("keeps every option for an empty search", () => {
    expect(values("  ")).toEqual(["flash", "sonnet", "custom:qwen"])
  })

  it("matches the name, the technical id and the group, ignoring case", () => {
    expect(values("FLASH")).toEqual(["flash"])
    expect(values("sonnet-5")).toEqual(["sonnet"])
    expect(values("anthropic")).toEqual(["sonnet"])
  })

  it("needs every word to match", () => {
    expect(values("gemini flash")).toEqual(["flash"])
    expect(values("gemini sonnet")).toEqual([])
  })

  it("ignores accents", () => {
    expect(values("modeles")).toEqual(["custom:qwen"])
  })
})
