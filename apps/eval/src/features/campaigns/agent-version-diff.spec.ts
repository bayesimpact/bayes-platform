import { setupI18n } from "@lingui/core"
import { describe, expect, it } from "vitest"
import { buildAgentVersion, buildProjectAgent } from "@/test/factories/agents.factory"
import { buildMyOrganization, buildMyProject } from "@/test/factories/projects.factory"
import { agentVersionFieldText, changedAgentVersionFields } from "./agent-version-diff"

const agent = buildProjectAgent(buildMyProject(buildMyOrganization()))
const i18n = setupI18n({ locale: "en", messages: { en: {} } })

describe("changedAgentVersionFields", () => {
  it("lists the fields that differ, in the order the diff shows them", () => {
    const before = buildAgentVersion(agent, 1)
    const after = buildAgentVersion(agent, 2, {
      model: "another-model",
      instructions: "Answer in three sentences at most.",
      variables: { tone: "friendly" },
    })

    expect(changedAgentVersionFields(before, after, i18n)).toEqual([
      "instructions",
      "model",
      "variables",
    ])
    expect(changedAgentVersionFields(before, buildAgentVersion(agent, 3), i18n)).toEqual([])
  })

  it("reads a switch as On or Off, an object as indented JSON and nothing as an empty text", () => {
    const version = buildAgentVersion(agent, 1, {
      variables: { tone: "friendly" },
      greetingMessage: undefined,
    })

    expect(agentVersionFieldText(version, "variables", i18n)).toBe('{\n  "tone": "friendly"\n}')
    expect(agentVersionFieldText(version, "greetingMessage", i18n)).toBe("")
    expect(agentVersionFieldText(version, "fillFormEnabled", i18n)).toBe("Off")
  })
})
