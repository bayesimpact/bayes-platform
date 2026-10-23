import { AgentModel } from "@caseai-connect/api-contracts"
import { modelRequiresPdfAsImages } from "@/external/llm/agent-provider"

describe("modelRequiresPdfAsImages", () => {
  it.each([
    AgentModel.Gemma4_26B,
    AgentModel.Gemma4_31B,
    AgentModel.MedGemma10_27B,
    AgentModel.Qwen38_27B,
  ])("sends the pdfs to %s as images", (model) => {
    expect(modelRequiresPdfAsImages(model)).toBe(true)
  })

  it.each([
    AgentModel.MistralSmall32_24B,
    AgentModel.Gemini25Flash,
    AgentModel._Mock,
  ])("sends the pdfs to %s as files", (model) => {
    expect(modelRequiresPdfAsImages(model)).toBe(false)
  })

  it("sends the pdfs as files to a model it does not know", () => {
    expect(modelRequiresPdfAsImages("unknown/model")).toBe(false)
  })
})
