import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { type AgentCreationChoice, getDefaultFormValues } from "./agent-form.shared"

describe("getDefaultFormValues", () => {
  const creationChoices: AgentCreationChoice[] = ["conversation", "extraction", "form"]

  const defaultModelOptions = {
    providerOptions: {
      vertex: { thinkingConfig: { thinkingLevel: "minimal", includeThoughts: true } },
    },
  }

  it.each(
    creationChoices,
  )("starts a %s agent on the given default model and its options", (creationChoice) => {
    const values = getDefaultFormValues({
      creationChoice,
      language: AgentLocale.EN,
      defaultModel: AgentModel.Gemini35FlashLite,
      defaultModelOptions,
    })

    expect(values.model).toBe(AgentModel.Gemini35FlashLite)
    expect(values.providerOptions).toEqual(defaultModelOptions)
    expect(values.documentsRagMode).toBe(DocumentsRagMode.All)
    expect(values.locale).toBe(AgentLocale.EN)
  })

  it("creates a form agent as a conversation agent with the fillForm tool and an output schema", () => {
    const values = getDefaultFormValues({
      creationChoice: "form",
      language: AgentLocale.FR,
      defaultModel: AgentModel.Gemini35FlashLite,
      defaultModelOptions,
    })

    expect(values).toMatchObject({ type: "conversation", fillFormEnabled: true })
    expect(values.outputJsonSchema).toBeDefined()
  })

  it("gives an extraction agent an output schema", () => {
    const values = getDefaultFormValues({
      creationChoice: "extraction",
      language: AgentLocale.EN,
      defaultModel: AgentModel.Gemini35FlashLite,
      defaultModelOptions,
    })

    expect(values.type).toBe("extraction")
    expect(values.outputJsonSchema).toBeDefined()
  })
})
