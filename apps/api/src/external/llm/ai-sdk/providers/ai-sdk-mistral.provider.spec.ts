import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { afterAll, beforeAll } from "@jest/globals"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { jsonSchema, tool } from "ai"
import type { LLMChatMessage, LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { GetAgentModelKeyFromValue } from "@/external/llm/agent-provider"
import { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { AISDKMistralProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mistral.provider"
import { ProviderSpecs } from "@/external/llm/ai-sdk/providers/provider-specs"
import { gcpCredentialsCheck } from "@/external/llm/ai-sdk/providers/spec-gcp-tools"
import { sdk } from "@/external/llm/open-telemetry-init"

const testModels = Object.values(AgentModel)
  .filter((am) => AgentModelToAgentProvider[am] === AgentProvider.Mistral)
  .map((m) => ({
    name: GetAgentModelKeyFromValue(m),
    model: m,
  }))

if (process.env.IS_TEST === "true" && process.env.MISTRAL_TEST === "true") {
  describe("AISDKMistralProvider", () => {
    jest.setTimeout(600_000)
    const traceProvider = new NodeTracerProvider({
      spanProcessors: [
        // new BatchSpanProcessor(new ConsoleSpanExporter()),
      ],
    })
    let provider: AISDKMistralProvider
    beforeAll(async () => {
      const conf = process.env.GOOGLE_APPLICATION_CREDENTIALS
      if (!conf) return
      provider = new AISDKMistralProvider()
      traceProvider.register()
    })
    afterAll(async () => {
      await traceProvider.forceFlush()
      await traceProvider.shutdown()
      await sdk.shutdown()
    })
    it("gcpCredentialsCheck", async () => {
      const check = await gcpCredentialsCheck()
      expect(check).toBeTruthy()
    })

    it.each(testModels)("generateText - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateText({ provider, model })
    })

    it.each(testModels)("generateStructuredOutput -pdf - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateStructuredOutputFromPdf({ provider, model })
    })

    it.each(testModels)("generateStructuredOutput -jpg - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateStructuredOutputFromMathematicalJpg({ provider, model })
    })

    it.each(testModels)("generateStructuredOutput -png - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateStructuredOutputFromXRayPng_FR({ provider, model })
    })

    it.each(testModels)("generateStructuredOutput -png (low res) - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateStructuredOutputFromXRayLowPng_FR({ provider, model })
    })

    it.each(testModels)("streamChatResponse - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponse({ provider, model })
    })

    it.each(testModels)("streamChatResponse with tools - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithTools({
        provider,
        model,
        advancedExpectation: true,
      })
    })

    it.each(testModels)("streamChatResponse with tools - BIS - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithToolsBis({
        provider,
        model,
        advancedExpectation: true,
      })
    })

    it.each(testModels)("streamChatResponse with tools - TER - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithToolsTer({
        provider,
        model,
        advancedExpectation: true,
      })
    })

    it.each(testModels)("streamChatResponse with multiple tools - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithMultipleTools({
        provider,
        model,
        advancedExpectation: true,
      })
    })
  })
} else {
  describe.skip("AISDKMistralProvider", () => {
    it.each(
      testModels,
    )("skipped (requires process.env.IS_TEST=true and process.env.MISTRAL_TEST=true)", () => {})
  })
}

class TestAISDKMistralProvider extends AISDKMistralProvider {
  structuredOutputMessageFor(message: LLMChatMessage): LLMChatMessage {
    return this.applySpecificToStructuredOutputMessage({ message, config: {} as LLMConfig })
  }
}

describe("AISDKMistralProvider.applySpecificToStructuredOutputMessage", () => {
  const provider = new TestAISDKMistralProvider()

  it("refuses a PDF file", () => {
    expect(() =>
      provider.structuredOutputMessageFor({
        role: "user",
        content: [
          { type: "text", text: "Give it a title." },
          { type: "file", data: "aGVsbG8=", mediaType: "application/pdf" },
        ],
      }),
    ).toThrow("Model cannot process application/pdf file")
  })

  it("keeps a message without PDF as is", () => {
    const message: LLMChatMessage = {
      role: "user",
      content: [
        { type: "text", text: "Give it a title." },
        { type: "file", data: "aGVsbG8=", mediaType: "image/png" },
      ],
    }
    expect(provider.structuredOutputMessageFor(message)).toBe(message)
  })
})

describe("AISDKMistralProvider.applySpecificToSystemPrompt", () => {
  const provider = new AISDKMistralProvider()
  const config = {
    model: AgentModel.MistralSmall31_24B,
    tools: {
      search_documents: tool({
        description: "Searches the documents.",
        inputSchema: jsonSchema({
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        }),
      }),
    },
  } as unknown as LLMConfig

  it("appends the tools and their parameters to the system prompt of a turn with tools", () => {
    const prompt = provider.applySpecificToSystemPrompt({
      config,
      systemPrompt: "You answer pricing questions.",
      callOrigin: CallOrigin.streamChatResponse_withTools,
    })

    expect(prompt).toBe(`You answer pricing questions.

##TOOLS
You have access to the following tools:
- search_documents: Searches the documents.
  Parameters: { query: string }

(CRITICAL) If a parameters allows null, set the value to null when unknown. Set to null not to quoted "null"`)
  })

  it("keeps the system prompt of a call without tools", () => {
    expect(
      provider.applySpecificToSystemPrompt({
        config,
        systemPrompt: "You answer pricing questions.",
        callOrigin: CallOrigin.generateText,
      }),
    ).toBe("You answer pricing questions.")
  })
})
