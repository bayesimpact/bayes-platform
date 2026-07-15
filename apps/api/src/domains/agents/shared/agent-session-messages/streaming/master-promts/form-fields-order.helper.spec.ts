import { ToolName } from "@caseai-connect/api-contracts"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { promptHelpers } from "./helpers"

function buildAgentSettings(outputJsonSchema: Record<string, unknown>): AgentSettings {
  return { outputJsonSchema } as AgentSettings
}

describe("promptHelpers.tools - FillForm field order", () => {
  const outputJsonSchema = {
    type: "object",
    properties: {
      country: { type: "string", description: "What country do you live in?" },
      language: { type: "string", description: "What is your preferred language?" },
      age: { type: "number", description: "How old are you?" },
    },
  }

  const fieldLines = (prompt: string) =>
    prompt
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).split(":")[0])

  it("lists form fields in propertyOrdering order", () => {
    const prompt = promptHelpers.tools({
      names: [ToolName.FillForm],
      agentSettings: buildAgentSettings({
        ...outputJsonSchema,
        propertyOrdering: ["language", "age", "country"],
      }),
    })

    expect(fieldLines(prompt)).toEqual(["language", "age", "country"])
  })

  it("falls back to properties key order when no ordering is provided", () => {
    const prompt = promptHelpers.tools({
      names: [ToolName.FillForm],
      agentSettings: buildAgentSettings(outputJsonSchema),
    })

    expect(fieldLines(prompt)).toEqual(["country", "language", "age"])
  })
})
