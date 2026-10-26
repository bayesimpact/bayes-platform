import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { afterAll, beforeAll } from "@jest/globals"
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { jsonSchema, tool } from "ai"
import { z } from "zod"
import type { LLMCallContext, LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { getAgentModelKey } from "@/external/llm/agent-provider"
import { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { AISDKMedGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-med-gemma.provider"
import { ProviderSpecs } from "@/external/llm/ai-sdk/providers/provider-specs"
import { sdk } from "@/external/llm/open-telemetry-init"

const testModels = Object.values(AgentModel)
  .filter(
    (am) =>
      AgentModelToAgentProvider[am] === AgentProvider.MedGemma && am === AgentModel.MedGemma10_27B,
  )
  .map((m) => ({
    name: getAgentModelKey(m),
    model: m,
  }))

if (process.env.IS_TEST === "true" && process.env.MEDGEMMA_TEST === "true") {
  describe("AISDKMedGemmaProvider", () => {
    jest.setTimeout(600_000)
    const traceProvider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(new ConsoleSpanExporter())],
    })
    let provider: AISDKMedGemmaProvider
    beforeAll(async () => {
      const conf = process.env.GOOGLE_APPLICATION_CREDENTIALS
      if (!conf) return
      provider = new AISDKMedGemmaProvider()
      traceProvider.register()
    })
    afterAll(async () => {
      await traceProvider.forceFlush()
      await traceProvider.shutdown()
      await sdk.shutdown()
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
        advancedExpectation: false,
      })
    })

    it.each(testModels)("streamChatResponse with tools - BIS - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithToolsBis({
        provider,
        model,
        advancedExpectation: false,
      })
    })

    it.each(testModels)("streamChatResponse with tools - TER - $name", async ({ model }) => {
      await ProviderSpecs.testStreamChatResponseWithToolsTer({
        provider,
        model,
        advancedExpectation: false,
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
  describe.skip("AISDKMedGemmaProvider", () => {
    it.each(
      testModels,
    )("skipped (requires process.env.IS_TEST=true and process.env.MEDGEMMA_TEST=true)", () => {})
  })
}

class TestAISDKMedGemmaProvider extends AISDKMedGemmaProvider {
  systemPromptFor(args: { config: LLMConfig; systemPrompt: string; callOrigin: CallOrigin }) {
    return this.applySpecificToSystemPrompt(args)
  }
  readStructuredOutputFor(text: string): Record<string, unknown> {
    return this.readStructuredOutput({
      text,
      get output(): Record<string, unknown> {
        throw new Error("the AI SDK output must not be read")
      },
    })
  }
}

describe("AISDKMedGemmaProvider.readStructuredOutput", () => {
  it("reads the object from the text, ignoring the output the AI SDK parsed", () => {
    const provider = new TestAISDKMedGemmaProvider()

    expect(provider.readStructuredOutputFor('```json\n{"title":"Pricing"}\n```')).toEqual({
      title: "Pricing",
    })
  })
})

describe("AISDKMedGemmaProvider through the AI SDK (vLLM simulated)", () => {
  const URL_ENV = "VLLM_MEDGEMMA10_27B_URL"
  const API_KEY_ENV = "VLLM_MEDGEMMA10_27B_APIKEY" // gitleaks:allow (the name of the variable, not a key)
  const savedEnv = { url: process.env[URL_ENV], apiKey: process.env[API_KEY_ENV] }

  const callContext: LLMCallContext = {
    traceId: "trace-id",
    agentSessionId: "agent-session-id",
    currentTurn: 1,
    organizationId: "organization-id",
    projectId: "project-id",
    agentId: "agent-id",
    revision: 1,
  }

  // Tools route the chat turn to the custom MedGemma model.
  const config = {
    model: AgentModel.MedGemma10_27B,
    temperature: 0,
    systemPrompt: "You answer pricing questions.",
    serviceTier: undefined,
    tools: {
      lookup_knowledge_base: tool({
        description: "Looks up the knowledge base.",
        inputSchema: z.object({ query: z.string() }),
        execute: async () => "Plans start at 10 euros.",
      }),
    },
  } as LLMConfig

  const sseResponse = (lines: string[]) =>
    new Response(lines.map((line) => `${line}\n`).join(""), { status: 200 })

  const sseTurn = (output: unknown) =>
    sseResponse([
      `data: ${JSON.stringify({
        choices: [{ delta: { content: JSON.stringify(output) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      })}`,
      "data: [DONE]",
    ])

  const collect = async (provider: AISDKMedGemmaProvider) => {
    let text = ""
    for await (const chunk of provider.streamChatResponse({
      additionalMetadata: {},
      messages: [{ role: "user", content: "What does it cost?" }],
      config,
      callContext,
    })) {
      text += chunk
    }
    return text
  }

  beforeEach(() => {
    process.env[URL_ENV] = "http://medgemma.test"
    process.env[API_KEY_ENV] = "vllm-api-key"
  })

  afterEach(() => {
    jest.restoreAllMocks()
    for (const [name, value] of [
      [URL_ENV, savedEnv.url],
      [API_KEY_ENV, savedEnv.apiKey],
    ] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })

  it("streams the answer of a turn that calls a tool first", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        sseTurn({ type: "tool", name: "lookup_knowledge_base", arguments: { query: "pricing" } }),
      )
      .mockResolvedValueOnce(sseTurn({ type: "answer", content: "Plans start at 10 euros." }))

    const text = await collect(new AISDKMedGemmaProvider())

    expect(text).toBe("Plans start at 10 euros.")
    // The second call carries the tool call and its result back to the model.
    const secondBody = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))
    expect(JSON.stringify(secondBody.messages)).toContain(
      '<tool_result name=\\"lookup_knowledge_base\\">Plans start at 10 euros.</tool_result>',
    )
  })

  it("repairs tool arguments the model got wrong, through the custom model", async () => {
    const execute = jest.fn().mockResolvedValue("Plans start at 10 euros.")
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      // The model calls the tool without its required query…
      .mockResolvedValueOnce(
        sseTurn({ type: "tool", name: "lookup_knowledge_base", arguments: {} }),
      )
      // …the repair regenerates the arguments through structured output…
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"query":"pricing"}' }, finish_reason: "stop" }],
            usage: { prompt_tokens: 20, completion_tokens: 4 },
          }),
          { status: 200 },
        ),
      )
      // …and the model answers with the tool result.
      .mockResolvedValueOnce(sseTurn({ type: "answer", content: "Plans start at 10 euros." }))

    let text = ""
    for await (const chunk of new AISDKMedGemmaProvider().streamChatResponse({
      additionalMetadata: {},
      messages: [{ role: "user", content: "What does it cost?" }],
      config: {
        ...config,
        tools: {
          lookup_knowledge_base: tool({
            description: "Looks up the knowledge base.",
            inputSchema: z.object({ query: z.string() }),
            execute,
          }),
        },
      } as LLMConfig,
      callContext,
    })) {
      text += chunk
    }

    expect(execute).toHaveBeenCalledWith({ query: "pricing" }, expect.anything())
    expect(text).toBe("Plans start at 10 euros.")
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it("reports the model's own error message to the caller", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        sseResponse([
          `data: ${JSON.stringify({ error: { message: "context too long", type: "BadRequestError" } })}`,
          "data: [DONE]",
        ]),
      )

    await expect(collect(new AISDKMedGemmaProvider())).rejects.toThrow("context too long")
  })

  it("reports an HTTP error with its status", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response('{"error":{"message":"bad request"}}', { status: 400 }))

    await expect(collect(new AISDKMedGemmaProvider())).rejects.toThrow("status 400")
  })

  it("returns the object of a structured output call", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: '```json\n{"title":"Pricing"}\n```' }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 30, completion_tokens: 8 },
        }),
        { status: 200 },
      ),
    )

    const output = await new AISDKMedGemmaProvider().generateStructuredOutput({
      additionalMetadata: {},
      message: { role: "user", content: "Give it a title." },
      schema: { type: "object", properties: { title: { type: "string" } } },
      config,
      callContext,
    })

    expect(output).toEqual({ title: "Pricing" })
  })
})

describe("AISDKMedGemmaProvider.applySpecificToSystemPrompt", () => {
  it("lists the tools and their parameters, including an MCP tool, in a turn with tools", () => {
    const prompt = new TestAISDKMedGemmaProvider().systemPromptFor({
      config: {
        model: AgentModel.MedGemma10_27B,
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
      } as unknown as LLMConfig,
      systemPrompt: "You answer pricing questions.",
      callOrigin: CallOrigin.streamChatResponse_withTools,
    })

    expect(prompt).toContain(
      "- search_documents: Searches the documents.\n  Parameters: { query: string }",
    )
    expect(prompt).toContain('{type:"answer", content:')
  })
})
