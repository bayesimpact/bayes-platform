import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "@jest/globals"
import type {
  AgentSettingsCreateFields,
  AgentSettingsUpdateFields,
} from "@/domains/agents/settings/agent.settings.types"
import {
  extractAgentSettingsCreateFields,
  extractAgentSettingsUpdateFields,
  requiresNewAgentSettingsRevision,
} from "./agent.settings.functions"

const fullFields: AgentSettingsCreateFields = {
  instructions: "You are a helpful assistant",
  documentsRagMode: DocumentsRagMode.All,
  model: AgentModel._MockStreamChatResponse,
  temperature: 0.7,
  locale: AgentLocale.EN,
  outputJsonSchema: { type: "object" },
  greetingMessage: "Hello there",
}

describe("extractAgentSettingsCreateFields", () => {
  it("extracts all known settings fields", () => {
    expect(extractAgentSettingsCreateFields(fullFields)).toEqual(fullFields)
  })

  it("only picks the whitelisted keys and drops unknown ones", () => {
    const result = extractAgentSettingsCreateFields({
      ...fullFields,
      id: "some-id",
      revision: 3,
      organizationId: "org-id",
    })

    expect(result).toEqual(fullFields)
    expect(result).not.toHaveProperty("id")
    expect(result).not.toHaveProperty("revision")
    expect(result).not.toHaveProperty("organizationId")
  })

  it("returns only the keys present in the input", () => {
    const result = extractAgentSettingsCreateFields({
      instructions: "Just instructions",
      model: AgentModel._MockStreamChatResponse,
    })

    expect(result).toEqual({
      instructions: "Just instructions",
      model: AgentModel._MockStreamChatResponse,
    })
  })

  it("preserves nullish values when the key is present", () => {
    const result = extractAgentSettingsCreateFields({
      greetingMessage: null,
      outputJsonSchema: null,
    })

    expect(result).toEqual({ greetingMessage: null, outputJsonSchema: null })
    expect(result).toHaveProperty("greetingMessage")
    expect(result).toHaveProperty("outputJsonSchema")
  })

  it("returns an empty object when no known keys are present", () => {
    expect(extractAgentSettingsCreateFields({ unrelated: "value" })).toEqual({})
  })
})

describe("extractAgentSettingsUpdateFields", () => {
  it("extracts all known settings fields", () => {
    expect(extractAgentSettingsUpdateFields(fullFields)).toEqual(fullFields)
  })

  it("only picks the whitelisted keys and drops unknown ones", () => {
    const result = extractAgentSettingsUpdateFields({
      instructions: "Updated",
      temperature: 0.2,
      somethingElse: true,
    })

    expect(result).toEqual({ instructions: "Updated", temperature: 0.2 })
    expect(result).not.toHaveProperty("somethingElse")
  })

  it("returns an empty object when no known keys are present", () => {
    expect(extractAgentSettingsUpdateFields({})).toEqual({})
  })
})

describe("requiresNewAgentSettingsRevision", () => {
  it("returns false when settings are identical", () => {
    expect(
      requiresNewAgentSettingsRevision({
        initialAgentSettings: fullFields,
        modifiedAgentSettings: { ...fullFields },
      }),
    ).toBe(false)
  })

  it("returns false for two empty settings objects", () => {
    expect(
      requiresNewAgentSettingsRevision({
        initialAgentSettings: {},
        modifiedAgentSettings: {},
      }),
    ).toBe(false)
  })

  it("returns true when a field value changes", () => {
    expect(
      requiresNewAgentSettingsRevision({
        initialAgentSettings: fullFields,
        modifiedAgentSettings: { ...fullFields, instructions: "Changed" },
      }),
    ).toBe(true)
  })

  it("returns true when a field is added", () => {
    const initial: Partial<AgentSettingsUpdateFields> = { instructions: "Same" }
    const modified: Partial<AgentSettingsUpdateFields> = {
      instructions: "Same",
      greetingMessage: "New greeting",
    }

    expect(
      requiresNewAgentSettingsRevision({
        initialAgentSettings: initial,
        modifiedAgentSettings: modified,
      }),
    ).toBe(true)
  })

  it("returns true when a field is removed", () => {
    expect(
      requiresNewAgentSettingsRevision({
        initialAgentSettings: { instructions: "Same", greetingMessage: "Greeting" },
        modifiedAgentSettings: { instructions: "Same" },
      }),
    ).toBe(true)
  })

  it("treats undefined on both sides as no change", () => {
    expect(
      requiresNewAgentSettingsRevision({
        initialAgentSettings: { instructions: "Same", greetingMessage: undefined },
        modifiedAgentSettings: { instructions: "Same" },
      }),
    ).toBe(false)
  })

  it("treats null vs undefined as a change", () => {
    expect(
      requiresNewAgentSettingsRevision({
        initialAgentSettings: { greetingMessage: null },
        modifiedAgentSettings: { greetingMessage: undefined },
      }),
    ).toBe(true)
  })

  it("ignores changes to keys outside the settings whitelist", () => {
    expect(
      requiresNewAgentSettingsRevision({
        initialAgentSettings: {
          instructions: "Same",
          id: "a",
        } as Partial<AgentSettingsUpdateFields>,
        modifiedAgentSettings: {
          instructions: "Same",
          id: "b",
        } as Partial<AgentSettingsUpdateFields>,
      }),
    ).toBe(false)
  })
})
