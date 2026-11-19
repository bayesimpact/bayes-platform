import { describe, expect, it } from "vitest"
import { buildAgentVersion, buildProjectAgent } from "@/test/factories/agents.factory"
import { buildMyOrganization, buildMyProject } from "@/test/factories/projects.factory"
import { agentVersionFieldText, changedAgentVersionFields } from "./agent-version-diff"

const agent = buildProjectAgent(buildMyProject(buildMyOrganization()))

describe("changedAgentVersionFields", () => {
  it("lists the fields that differ, in the order the diff shows them", () => {
    const before = buildAgentVersion(agent, 1)
    const after = buildAgentVersion(agent, 2, {
      model: "another-model",
      instructions: "Answer in three sentences at most.",
      variables: { tone: "friendly" },
    })

    expect(changedAgentVersionFields(before, after)).toEqual(["instructions", "model", "variables"])
    expect(changedAgentVersionFields(before, buildAgentVersion(agent, 3))).toEqual([])
  })

  it("reads an object as indented JSON and nothing as an empty text", () => {
    const version = buildAgentVersion(agent, 1, {
      variables: { tone: "friendly" },
      greetingMessage: undefined,
    })

    expect(agentVersionFieldText(version, "variables")).toBe('{\n  "tone": "friendly"\n}')
    expect(agentVersionFieldText(version, "greetingMessage")).toBe("")
    expect(agentVersionFieldText(version, "fillFormEnabled")).toBe("false")
  })
})
