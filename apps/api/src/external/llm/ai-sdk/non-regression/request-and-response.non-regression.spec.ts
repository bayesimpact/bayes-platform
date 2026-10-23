import { AgentModel } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import {
  callContext,
  collect,
  configFor,
  gemini,
  installFakeFetch,
  installWarningCollector,
  openAiChat,
} from "@/external/llm/ai-sdk/non-regression/non-regression.harness"
import { AISDKGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-gemma.provider"
import { AISDKVertex3Provider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex3.provider"

jest.mock("google-auth-library", () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: async () => ({ getAccessToken: async () => ({ token: "test-access-token" }) }),
  })),
}))

process.env.GOOGLE_VERTEX_PROJECT = "test-project"
process.env.VLLM_GEMMA4_26B_URL = "https://gemma.vllm.test/v1"
process.env.VLLM_GEMMA4_26B_APIKEY = "test-api-key"

const weatherTool = () => {
  const execute = jest.fn(async ({ city }: { city: string }) => ({ city, forecast: "sunny" }))
  return {
    execute,
    tools: {
      get_weather: tool({
        description: "Gives the weather of a city",
        inputSchema: z.object({ city: z.string() }),
        execute,
      }),
    },
  }
}

const SUMMARY_SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, summary: { type: "string" } },
  required: ["title", "summary"],
  additionalProperties: false,
}

/**
 * What the AI SDK sends besides the model options (endpoint, authentication,
 * prompt, tools, response format) and how it reads the answer back (text,
 * thoughts, tool calls, structured output). One provider per API family:
 * Vertex 3 for the Gemini API, Gemma for vLLM's OpenAI chat completions.
 */
describe("AI SDK non-regression - request and response", () => {
  let fakeFetch: ReturnType<typeof installFakeFetch>
  let warningCollector: ReturnType<typeof installWarningCollector>

  beforeEach(() => {
    fakeFetch = installFakeFetch()
    warningCollector = installWarningCollector()
  })

  afterEach(() => {
    fakeFetch.restore()
    warningCollector.restore()
    expect(warningCollector.warnings).toEqual([])
  })

  describe("Gemini API (Vertex 3)", () => {
    const provider = new AISDKVertex3Provider()
    const model = AgentModel.Gemini35Flash

    it("calls the model on the EU endpoint of the project, with a Google access token", async () => {
      fakeFetch.respondWith(gemini.text("Hello"))

      await provider.generateText({
        additionalMetadata: {},
        prompt: "Hi",
        config: configFor(model),
        callContext,
      })

      const request = fakeFetch.onlyRequest()
      expect(request.method).toBe("POST")
      expect(request.url).toBe(
        `https://aiplatform.eu.rep.googleapis.com/v1beta1/projects/test-project/locations/eu/publishers/google/models/${model}:generateContent`,
      )
      expect(request.headers.authorization).toBe("Bearer test-access-token")
    })

    it("streams through the SSE endpoint", async () => {
      fakeFetch.respondWith(gemini.streamedText(["Hel", "lo"]))

      await collect(
        provider.streamChatResponse({
          additionalMetadata: {},
          messages: [{ role: "user", content: "Hi" }],
          config: configFor(model),
          callContext,
        }),
      )

      expect(fakeFetch.onlyRequest().url).toMatch(/:streamGenerateContent\?alt=sse$/)
    })

    it("sends the system prompt apart and the conversation as contents", async () => {
      fakeFetch.respondWith(gemini.streamedText(["Fine"]))

      await collect(
        provider.streamChatResponse({
          additionalMetadata: {},
          messages: [
            { role: "user", content: "Hi" },
            { role: "assistant", content: "Hello, how can I help?" },
            { role: "user", content: "How are you?" },
          ],
          config: configFor(model, { systemPrompt: "Be brief." }),
          callContext,
        }),
      )

      expect(fakeFetch.onlyRequest().body).toMatchObject({
        systemInstruction: { parts: [{ text: "Be brief." }] },
        contents: [
          { role: "user", parts: [{ text: "Hi" }] },
          { role: "model", parts: [{ text: "Hello, how can I help?" }] },
          { role: "user", parts: [{ text: "How are you?" }] },
        ],
      })
    })

    it.each([
      "priority",
      "flex",
    ] as const)("sends the %s service tier of the call in its header", async (serviceTier) => {
      fakeFetch.respondWith(gemini.text("Hello"))

      await provider.generateText({
        additionalMetadata: {},
        prompt: "Hi",
        config: configFor(model, { serviceTier }),
        callContext,
      })

      expect(fakeFetch.onlyRequest().headers["x-vertex-ai-llm-shared-request-type"]).toBe(
        serviceTier,
      )
    })

    it("keeps the model's thoughts out of the answer", async () => {
      fakeFetch.respondWith(gemini.streamedText(["Hel", "lo"], { thought: "The user greets me." }))

      const text = await collect(
        provider.streamChatResponse({
          additionalMetadata: {},
          messages: [{ role: "user", content: "Hi" }],
          config: configFor(model),
          callContext,
        }),
      )

      expect(text).toBe("Hello")
    })

    it("declares strict tools, runs the one the model calls and sends its result back", async () => {
      const { execute, tools } = weatherTool()
      fakeFetch.respondWith(
        gemini.streamedToolCall("get_weather", { city: "Paris" }),
        gemini.streamedText(["It is sunny in Paris."]),
      )

      const text = await collect(
        provider.streamChatResponse({
          additionalMetadata: {},
          messages: [{ role: "user", content: "Weather in Paris?" }],
          config: configFor(model, { tools }),
          callContext,
        }),
      )

      expect(text).toBe("It is sunny in Paris.")
      expect(execute).toHaveBeenCalledWith({ city: "Paris" }, expect.anything())
      expect(fakeFetch.requests).toHaveLength(2)
      const [first, second] = fakeFetch.requests
      expect(first?.body).toMatchObject({
        tools: [
          {
            functionDeclarations: [
              { name: "get_weather", description: "Gives the weather of a city" },
            ],
          },
        ],
        toolConfig: { functionCallingConfig: { mode: "VALIDATED" } },
      })
      // The call is replayed with its thought signature: Gemini 3 rejects it without one.
      expect(second?.body.contents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "model",
            parts: [
              expect.objectContaining({
                functionCall: expect.objectContaining({
                  name: "get_weather",
                  args: { city: "Paris" },
                }),
                thoughtSignature: "signature-1",
              }),
            ],
          }),
          expect.objectContaining({
            parts: [
              expect.objectContaining({
                functionResponse: expect.objectContaining({ name: "get_weather" }),
              }),
            ],
          }),
        ]),
      )
    })

    it("asks for JSON of the schema and reads the object back", async () => {
      fakeFetch.respondWith(gemini.text(JSON.stringify({ title: "Plan", summary: "Short" })))

      const output = await provider.generateStructuredOutput({
        additionalMetadata: {},
        message: { role: "user", content: "Summarize" },
        schema: SUMMARY_SCHEMA,
        config: configFor(model),
        callContext,
      })

      expect(output).toEqual({ title: "Plan", summary: "Short" })
      expect(fakeFetch.onlyRequest().body).toMatchObject({
        generationConfig: { responseMimeType: "application/json" },
      })
    })
  })

  describe("OpenAI chat completions (vLLM, Gemma)", () => {
    const provider = new AISDKGemmaProvider()
    const model = AgentModel.Gemma4_26B

    it("calls the chat completions of the model's endpoint, with a Google access token", async () => {
      fakeFetch.respondWith(openAiChat.text("Hello"))

      await provider.generateText({
        additionalMetadata: {},
        prompt: "Hi",
        config: configFor(model),
        callContext,
      })

      const request = fakeFetch.onlyRequest()
      expect(request.url).toBe("https://gemma.vllm.test/v1/chat/completions")
      expect(request.headers.authorization).toBe("Bearer test-access-token")
      expect(request.body).toMatchObject({
        model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hi" },
        ],
      })
    })

    it("streams the answer and asks for the usage", async () => {
      fakeFetch.respondWith(openAiChat.streamedText(["Hel", "lo"]))

      const text = await collect(
        provider.streamChatResponse({
          additionalMetadata: {},
          messages: [{ role: "user", content: "Hi" }],
          config: configFor(model),
          callContext,
        }),
      )

      expect(text).toBe("Hello")
      expect(fakeFetch.onlyRequest().body).toMatchObject({
        stream: true,
        stream_options: { include_usage: true },
      })
    })

    it("declares the tools, runs the one the model calls and sends its result back", async () => {
      const { execute, tools } = weatherTool()
      fakeFetch.respondWith(
        openAiChat.streamedToolCall("get_weather", { city: "Paris" }),
        openAiChat.streamedText(["It is sunny in Paris."]),
      )

      const text = await collect(
        provider.streamChatResponse({
          additionalMetadata: {},
          messages: [{ role: "user", content: "Weather in Paris?" }],
          config: configFor(model, { tools }),
          callContext,
        }),
      )

      expect(text).toBe("It is sunny in Paris.")
      expect(execute).toHaveBeenCalledWith({ city: "Paris" }, expect.anything())
      const [first, second] = fakeFetch.requests
      expect(first?.body).toMatchObject({
        tools: [
          {
            type: "function",
            function: { name: "get_weather", description: "Gives the weather of a city" },
          },
        ],
      })
      expect(second?.body.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            tool_calls: [expect.objectContaining({ id: "call_1", type: "function" })],
          }),
          expect.objectContaining({ role: "tool", tool_call_id: "call_1" }),
        ]),
      )
    })

    const structuredOutput = () =>
      provider.generateStructuredOutput({
        additionalMetadata: {},
        message: { role: "user", content: "Summarize" },
        schema: SUMMARY_SCHEMA,
        config: configFor(model),
        callContext,
      })

    it("asks for JSON of the schema and reads the object from the text", async () => {
      fakeFetch.respondWith(openAiChat.text(JSON.stringify({ title: "Plan", summary: "Short" })))

      expect(await structuredOutput()).toEqual({ title: "Plan", summary: "Short" })
      expect(fakeFetch.onlyRequest().body).toMatchObject({
        response_format: { type: "json_schema" },
      })
    })

    // The SDK parses the output itself as soon as the generation stops, before
    // the provider reads the text: JSON wrapped in a code fence fails there, so
    // the fence stripping of parseStructuredOutputText never runs on it. Kept
    // here so that a version of the SDK that changes this shows up.
    it("fails on JSON wrapped in a code fence, before the provider reads the text", async () => {
      fakeFetch.respondWith(
        openAiChat.text(
          `\`\`\`json\n${JSON.stringify({ title: "Plan", summary: "Short" })}\n\`\`\``,
        ),
      )

      await expect(structuredOutput()).rejects.toThrow("No object generated")
    })
  })
})
