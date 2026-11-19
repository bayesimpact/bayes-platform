import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { afterAll, beforeAll } from "@jest/globals"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { jsonSchema, tool } from "ai"
import { z } from "zod"
import type { LLMChatMessage, LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { getAgentModelKey } from "@/external/llm/agent-provider"
import { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import {
  type CapturedRequest,
  callContext,
  collect,
  configFor,
  installFakeFetch,
  openAiChat,
} from "@/external/llm/ai-sdk/non-regression/non-regression.harness"
import { AISDKMistralProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mistral.provider"
import { ProviderSpecs } from "@/external/llm/ai-sdk/providers/provider-specs"
import { gcpCredentialsCheck } from "@/external/llm/ai-sdk/providers/spec-gcp-tools"
import { sdk } from "@/external/llm/open-telemetry-init"

const advancedTest = true
const liveToolCallsTest = true

const testModels = Object.values(AgentModel)
  .filter((am) => AgentModelToAgentProvider[am] === AgentProvider.Mistral)
  .map((m) => ({
    name: getAgentModelKey(m),
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
  systemPromptFor(args: { config: LLMConfig; systemPrompt: string; callOrigin: CallOrigin }) {
    return this.applySpecificToSystemPrompt(args)
  }
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
  const provider = new TestAISDKMistralProvider()
  const config = {
    model: AgentModel.MistralSmall32_24B,
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

  it("appends only the null rule to the system prompt of a turn with tools, not the tools", () => {
    const prompt = provider.systemPromptFor({
      config,
      systemPrompt: "You answer pricing questions.",
      callOrigin: CallOrigin.streamChatResponse_withTools,
    })

    expect(prompt).toBe(`You answer pricing questions.

(CRITICAL) If a parameters allows null, set the value to null when unknown. Set to null not to quoted "null"`)
  })

  it("keeps the system prompt of a turn with an empty tool set", () => {
    expect(
      provider.systemPromptFor({
        config: { ...config, tools: {} } as LLMConfig,
        systemPrompt: "You answer pricing questions.",
        callOrigin: CallOrigin.streamChatResponse_withTools,
      }),
    ).toBe("You answer pricing questions.")
  })

  it("keeps the system prompt of a call without tools", () => {
    expect(
      provider.systemPromptFor({
        config,
        systemPrompt: "You answer pricing questions.",
        callOrigin: CallOrigin.generateText,
      }),
    ).toBe("You answer pricing questions.")
  })
})

function printRequest(label: string, request: CapturedRequest | undefined) {
  if (!request) return
  process.stdout.write(
    `\n===== ${label}: ${request.method} ${request.url}\n${JSON.stringify(request.body, null, 2)}\n`,
  )
}

if (process.env.IS_TEST === "true" && advancedTest) {
  describe("AISDKMistralProvider - request sent with tools", () => {
    const SYSTEM_PROMPT = "You are a helpful assistant."
    const MISTRAL_URL = "https://mistral.vllm.test/v1"
    const envKeys = ["VLLM_MISTRALSMALL32_24B_URL", "VLLM_MISTRALSMALL32_24B_APIKEY"] as const
    const provider = new AISDKMistralProvider()
    const model = AgentModel.MistralSmall32_24B
    let savedEnv: Record<string, string | undefined> = {}
    let fakeFetch: ReturnType<typeof installFakeFetch>

    // The fake URL is set for this block only: the live tests above use the real one.
    beforeAll(() => {
      savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
      process.env.VLLM_MISTRALSMALL32_24B_URL = MISTRAL_URL
      process.env.VLLM_MISTRALSMALL32_24B_APIKEY = "test-api-key"
    })

    afterAll(() => {
      for (const key of envKeys) {
        if (savedEnv[key] === undefined) delete process.env[key]
        else process.env[key] = savedEnv[key]
      }
    })

    beforeEach(() => {
      fakeFetch = installFakeFetch()
    })

    afterEach(() => {
      fakeFetch.restore()
    })

    const buildTools = () => {
      const getWeather = jest.fn(async ({ city }: { city: string }) => ({
        city,
        forecast: "sunny",
      }))
      return {
        getWeather,
        tools: {
          get_weather: tool({
            description: "Gives the weather of a city",
            inputSchema: z.object({ city: z.string() }),
            execute: getWeather,
          }),
          search_documents: tool({
            description: "Searches the documents of the project",
            inputSchema: z.object({ query: z.string(), limit: z.number().nullable() }),
            execute: async () => ({ results: [] }),
          }),
        },
      }
    }

    it("declares the tools only in the tools parameter, then sends the tool result back", async () => {
      const { getWeather, tools } = buildTools()
      fakeFetch.respondWith(
        openAiChat.streamedToolCall("get_weather", { city: "Paris" }),
        openAiChat.streamedText(["It is sunny in Paris."]),
      )

      const text = await collect(
        provider.streamChatResponse({
          additionalMetadata: {},
          messages: [{ role: "user", content: "Weather in Paris?" }],
          config: configFor(model, { systemPrompt: SYSTEM_PROMPT, tools }),
          callContext,
        }),
      )

      const [toolCallRequest, toolResultRequest] = fakeFetch.requests
      printRequest("Request 1 (the model calls a tool)", toolCallRequest)
      printRequest("Request 2 (the tool result goes back)", toolResultRequest)

      expect(text).toBe("It is sunny in Paris.")
      expect(getWeather).toHaveBeenCalledWith({ city: "Paris" }, expect.anything())
      expect(fakeFetch.requests).toHaveLength(2)
      expect(toolCallRequest?.url).toBe(`${MISTRAL_URL}/chat/completions`)

      const messages = toolCallRequest?.body.messages as { role: string; content: unknown }[]
      const systemMessage = messages.find((message) => message.role === "system")
      expect(systemMessage?.content).toBe(`${SYSTEM_PROMPT}

(CRITICAL) If a parameters allows null, set the value to null when unknown. Set to null not to quoted "null"`)
      expect(messages).toContainEqual({ role: "user", content: "Weather in Paris?" })

      expect(toolCallRequest?.body).toMatchObject({
        model,
        stream: true,
        tools: [
          {
            type: "function",
            function: { name: "get_weather", description: "Gives the weather of a city" },
          },
          {
            type: "function",
            function: {
              name: "search_documents",
              description: "Searches the documents of the project",
            },
          },
        ],
      })

      expect(toolResultRequest?.body.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            tool_calls: [expect.objectContaining({ id: "call_1", type: "function" })],
          }),
          expect.objectContaining({ role: "tool", tool_call_id: "call_1" }),
        ]),
      )
    })
  })
} else {
  describe.skip("AISDKMistralProvider - request sent with tools", () => {
    it("skipped (requires process.env.IS_TEST=true, process.env.MISTRAL_TEST=true and advancedTest=true)", () => {})
  })
}

/**
 * LIVE: real calls to Mistral Small 3.2 (VLLM_MISTRALSMALL32_24B_URL and
 * _APIKEY of `.env.test`). Each case declares tools whose `execute` is a spy,
 * asks a question, and checks which tools the model called.
 *
 * The tools take nullable parameters the questions never give (a temperature
 * unit, the date of an exchange rate): the model must send null, not a made-up
 * value. This guards the rule the provider appends to the system prompt of a
 * turn with tools ("(CRITICAL) If a parameters allows null..."): without it,
 * Mistral Small 3.2 filled the unit with "celsius" (measured on 2026-11-17).
 * Mistral Small 3.1 is left out: its vLLM service was retired.
 */
if (process.env.IS_TEST === "true" && process.env.MISTRAL_TEST === "true" && liveToolCallsTest) {
  describe("AISDKMistralProvider - live tool calls", () => {
    const LIVE_TIMEOUT_MS = 120_000
    const provider = new AISDKMistralProvider()
    const SYSTEM_PROMPT =
      "You are a helpful assistant. Use a tool only when it is needed to answer. Answer in one or two short sentences."
    const model = AgentModel.MistralSmall32_24B

    const buildLiveTools = () => {
      const getWeather = jest.fn(
        async ({ city, unit }: { city: string; unit: "celsius" | "fahrenheit" | null }) => ({
          city,
          forecast: "sunny",
          temperature: unit === "fahrenheit" ? 70 : 21,
          unit: unit ?? "celsius",
        }),
      )
      const convertCurrency = jest.fn(
        async ({
          amount,
          from,
          to,
          date,
        }: {
          amount: number
          from: string
          to: string
          date: string | null
        }) => ({
          amount,
          from,
          to,
          date: date ?? "today",
          converted: Math.round(amount * 0.92 * 100) / 100,
        }),
      )
      const getCurrentTime = jest.fn(async ({ timezone }: { timezone: string }) => ({
        timezone,
        time: "14:30",
      }))
      const getWeatherTool = tool({
        description: "Gives the current weather of a city",
        inputSchema: z.object({
          city: z.string().describe("The name of the city"),
          unit: z
            .enum(["celsius", "fahrenheit"])
            .nullable()
            .describe("The temperature unit the user asked for"),
        }),
        execute: getWeather,
      })
      const convertCurrencyTool = tool({
        description: "Converts an amount of money from one currency to another",
        inputSchema: z.object({
          amount: z.number().describe("The amount to convert"),
          from: z.string().describe("The ISO code of the source currency, e.g. USD"),
          to: z.string().describe("The ISO code of the target currency, e.g. EUR"),
          date: z
            .string()
            .nullable()
            .describe("The date of the exchange rate the user asked for, YYYY-MM-DD"),
        }),
        execute: convertCurrency,
      })
      const getCurrentTimeTool = tool({
        description: "Gives the current time in a timezone",
        inputSchema: z.object({
          timezone: z.string().describe("An IANA timezone, e.g. Europe/Paris"),
        }),
        execute: getCurrentTime,
      })
      return {
        getWeather,
        convertCurrency,
        getCurrentTime,
        oneTool: { get_weather: getWeatherTool },
        threeTools: {
          get_weather: getWeatherTool,
          convert_currency: convertCurrencyTool,
          get_current_time: getCurrentTimeTool,
        },
      }
    }

    const ask = async (question: string, tools: LLMConfig["tools"]) => {
      const answer = await collect(
        provider.streamChatResponse({
          additionalMetadata: {},
          messages: [{ role: "user", content: question }],
          config: configFor(model, { systemPrompt: SYSTEM_PROMPT, tools }),
          callContext,
        }),
      )
      return answer
    }

    /** The calls and the answer of a case, in the console: a failure shows what the model did. */
    const printCase = (label: string, answer: string, spies: Record<string, jest.Mock>) => {
      const calls = Object.entries(spies)
        .map(
          ([name, spy]) =>
            `  ${name}: ${spy.mock.calls.length} call(s) ${JSON.stringify(spy.mock.calls.map((call) => call[0]))}`,
        )
        .join("\n")
      process.stdout.write(`\n===== ${label}\n${calls}\n  answer: ${answer}\n`)
    }

    it(
      "1 tool declared, not called: a question the tool does not answer",
      async () => {
        const { getWeather, oneTool } = buildLiveTools()

        const answer = await ask("Say hello to me in one short sentence.", oneTool)
        printCase("1 tool, not called", answer, { get_weather: getWeather })

        expect(getWeather).not.toHaveBeenCalled()
        expect(answer.trim()).not.toBe("")
      },
      LIVE_TIMEOUT_MS,
    )

    it(
      "1 tool declared, called: a question only the tool answers, no unit given",
      async () => {
        const { getWeather, oneTool } = buildLiveTools()

        const answer = await ask("What is the weather in Paris right now?", oneTool)
        printCase("1 tool, called", answer, { get_weather: getWeather })

        expect(getWeather).toHaveBeenCalledWith(
          { city: expect.stringMatching(/paris/i), unit: null },
          expect.anything(),
        )
        expect(answer.trim()).not.toBe("")
      },
      LIVE_TIMEOUT_MS,
    )

    it(
      "3 tools declared, 1 called: the model picks the right one, no unit given",
      async () => {
        const { getWeather, convertCurrency, getCurrentTime, threeTools } = buildLiveTools()

        const answer = await ask("What is the weather in Lyon right now?", threeTools)
        printCase("3 tools, 1 called", answer, {
          get_weather: getWeather,
          convert_currency: convertCurrency,
          get_current_time: getCurrentTime,
        })

        expect(getWeather).toHaveBeenCalledWith(
          { city: expect.stringMatching(/lyon/i), unit: null },
          expect.anything(),
        )
        expect(convertCurrency).not.toHaveBeenCalled()
        expect(getCurrentTime).not.toHaveBeenCalled()
        expect(answer.trim()).not.toBe("")
      },
      LIVE_TIMEOUT_MS,
    )

    it(
      "3 tools declared, 2 called: a question that needs two of them, no unit and no date given",
      async () => {
        const { getWeather, convertCurrency, getCurrentTime, threeTools } = buildLiveTools()

        const answer = await ask(
          "What is the weather in Paris right now, and how much is 100 USD in EUR?",
          threeTools,
        )
        printCase("3 tools, 2 called", answer, {
          get_weather: getWeather,
          convert_currency: convertCurrency,
          get_current_time: getCurrentTime,
        })

        expect(getWeather).toHaveBeenCalledWith(
          { city: expect.stringMatching(/paris/i), unit: null },
          expect.anything(),
        )
        expect(convertCurrency).toHaveBeenCalledWith(
          {
            amount: 100,
            from: expect.stringMatching(/usd/i),
            to: expect.stringMatching(/eur/i),
            date: null,
          },
          expect.anything(),
        )
        expect(getCurrentTime).not.toHaveBeenCalled()
        expect(answer.trim()).not.toBe("")
      },
      LIVE_TIMEOUT_MS,
    )
  })
} else {
  describe.skip("AISDKMistralProvider - live tool calls", () => {
    it("skipped (requires process.env.IS_TEST=true, process.env.MISTRAL_TEST=true and liveToolCallsTest=true)", () => {})
  })
}
