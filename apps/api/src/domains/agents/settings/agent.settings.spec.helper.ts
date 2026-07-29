import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { AgentSettingsValues } from "@/domains/agents/settings/agent-settings.service"

export const agentSettingsValuesRev1: AgentSettingsValues = {
  instructions: "This is a default prompt 1",
  model: AgentModel.Gemini25Flash,
  temperature: 0,
  locale: AgentLocale.EN,
  documentsRagMode: DocumentsRagMode.All,
  greetingMessage: "This is the greeting message 1",
  outputJsonSchema: {
    type: "object",
    properties: { aRequiredProperty1: { type: "string" } },
    required: ["aRequiredProperty1"],
  },
  fillFormEnabled: false,
}
export const agentSettingsValuesRev2Archived: AgentSettingsValues = {
  instructions: "This is a default prompt 2",
  model: AgentModel.Gemma4_26B,
  temperature: 1,
  locale: AgentLocale.FR,
  documentsRagMode: DocumentsRagMode.All,
  greetingMessage: "This is the greeting message 2",
  outputJsonSchema: {
    type: "object",
    properties: { aRequiredProperty2: { type: "number" } },
    required: ["aRequiredProperty2"],
  },
  fillFormEnabled: false,
}
export const agentSettingsValuesRev3Draft: AgentSettingsValues = {
  instructions: "This is a default prompt 3",
  model: AgentModel._Mock,
  temperature: 1,
  locale: AgentLocale.FR,
  documentsRagMode: DocumentsRagMode.All,
  greetingMessage: "This is the greeting message 3",
  outputJsonSchema: {
    type: "object",
    properties: { aRequiredProperty3: { type: "number" } },
    required: ["aRequiredProperty3"],
  },
  fillFormEnabled: false,
}

export function assertOnSettings(expected: object, value: AgentSettingsValues | undefined) {
  expect(value).toBeDefined()
  if (value) {
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.instructions).toBe(expected["instructions"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.model).toBe(expected["model"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(Number(value.temperature)).toBe(Number(expected["temperature"]))
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.locale).toBe(expected["locale"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.documentsRagMode).toBe(expected["documentsRagMode"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.greetingMessage).toBe(expected["greetingMessage"])
    // biome-ignore lint/complexity/useLiteralKeys: test usage
    expect(value.outputJsonSchema).toStrictEqual(expected["outputJsonSchema"])
  }
}
