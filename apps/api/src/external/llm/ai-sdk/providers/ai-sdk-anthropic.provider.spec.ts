import { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import type { LLMConfig, SpecificProviderOptions } from "@/common/interfaces/llm-provider.interface"
import { configFor, modelsOf } from "@/external/llm/ai-sdk/non-regression/non-regression.harness"
import { AISDKAnthropicProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-anthropic.provider"

/** Exposes the options the provider sends on each call. */
class TestAISDKAnthropicProvider extends AISDKAnthropicProvider {
  specificProviderOptionsFor(config: LLMConfig): SpecificProviderOptions {
    return this.buildSpecificProviderOptions({ config })
  }
}

const CLAUDE_MODELS = modelsOf(AgentProvider.Anthropic)
const EFFORTS = ["low", "medium", "high"] as const

const storedEffort = (effort: unknown) => ({ providerOptions: { anthropic: { effort } } })

describe("AISDKAnthropicProvider model metadata", () => {
  const provider = new TestAISDKAnthropicProvider()

  it("serves Claude Sonnet 5.5, Haiku 5.5 and Opus 5", () => {
    expect(CLAUDE_MODELS.sort()).toEqual(
      [AgentModel.ClaudeSonnet55, AgentModel.ClaudeHaiku55, AgentModel.ClaudeOpus5].sort(),
    )
  })

  describe.each(CLAUDE_MODELS)("%s", (model) => {
    it("reports the medium thinking level without stored options", () => {
      expect(provider.getModelMetadata(configFor(model))).toEqual({
        name: model,
        location: "eu",
        thinkingLevel: "MEDIUM",
      })
    })

    it.each(EFFORTS)("reports the stored effort %s", (effort) => {
      const config = configFor(model, { modelOptions: storedEffort(effort) })
      expect(provider.getModelMetadata(config)).toEqual({
        name: model,
        location: "eu",
        thinkingLevel: effort.toUpperCase(),
      })
    })

    it.each([
      "xhigh",
      "none",
      "HIGH",
      42,
      null,
    ])("reports the medium effort sent for the unknown effort %s", (effort) => {
      const config = configFor(model, { modelOptions: storedEffort(effort) })
      expect(provider.getModelMetadata(config)).toEqual({
        name: model,
        location: "eu",
        thinkingLevel: "MEDIUM",
      })
      expect(provider.specificProviderOptionsFor(config)).toEqual(storedEffort("medium"))
    })
  })
})
