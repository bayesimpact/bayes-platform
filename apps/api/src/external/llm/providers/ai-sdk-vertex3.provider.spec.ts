import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { afterAll, beforeAll } from "@jest/globals"
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { config as dotenvConfig } from "dotenv"
import { LangfuseIntegrationExporter } from "@/external/langfuse/langfuse-integration-exporter"
import { GetAgentModelKeyFromValue } from "@/external/llm/agent-provider"
import { sdk } from "@/external/llm/open-telemetry-init"
import { AISDKVertex3Provider } from "@/external/llm/providers/ai-sdk-vertex3.provider"
import { ProviderSpecs } from "@/external/llm/providers/provider-specs"
import { gcpCredentialsCheck } from "@/external/llm/providers/spec-gcp-tools"

dotenvConfig({ path: ".env", override: true, quiet: true })
dotenvConfig({ path: ".env.test", override: true, quiet: true })
const testModels = Object.values(AgentModel)
  .filter(
    (am) =>
      AgentModelToAgentProvider[am] === AgentProvider.Vertex3 &&
      process.env.VERTEX_PREVIEW_TEST === "true",
  )
  .map((m) => ({
    name: GetAgentModelKeyFromValue(m),
    model: m,
  }))

if (process.env.IS_TEST === "true" && process.env.VERTEX_PREVIEW_TEST === "true") {
  describe("AISDKVertex3Provider", () => {
    jest.setTimeout(60_000)
    const langfuse = new LangfuseIntegrationExporter({
      secretKey: process.env.LANGFUSE_SK,
      publicKey: process.env.LANGFUSE_PK,
      baseUrl: process.env.LANGFUSE_BASE_URL,
    })
    const traceProvider = new NodeTracerProvider({
      spanProcessors: [
        new BatchSpanProcessor(new ConsoleSpanExporter()),
        new BatchSpanProcessor(langfuse),
      ],
    })
    let provider: AISDKVertex3Provider
    beforeAll(async () => {
      const conf = process.env.GOOGLE_APPLICATION_CREDENTIALS
      if (!conf) return
      provider = new AISDKVertex3Provider()
      traceProvider.register()
    })
    afterAll(async () => {
      await langfuse.forceFlush()
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

    it.each(testModels)("generateObject - $name", async ({ model }) => {
      await ProviderSpecs.testGenerateObject({ provider, model })
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
  describe.skip("AISDKVertexProvider", () => {
    it("skipped (requires process.env.IS_TEST=true and process.env.VERTEX_TEST=true)", () => {})
  })
}
