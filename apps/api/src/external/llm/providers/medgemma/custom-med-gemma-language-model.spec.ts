import { AgentModel } from "@caseai-connect/api-contracts"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { CallOrigin } from "@/external/llm/ai-sdk-llm-common"
import { CustomMedGemmaLanguageModel } from "./custom-med-gemma-language-model"

describe("CustomMedGemmaLanguageModel", () => {
  const buildConfig = (): LLMConfig => ({
    model: AgentModel.MedGemma10_27B,
    temperature: 0,
    serviceTier: undefined,
  })

  const buildModel = () =>
    new CustomMedGemmaLanguageModel({
      baseUrl: "http://medgemma.test",
      apiKey: "k",
      config: buildConfig(),
    })

  const chatCompletionsResponse = () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
      { status: 200 },
    )

  const streamingChatCompletionsResponse = () => {
    const answer = JSON.stringify({ type: "answer", content: "ok" })
    const sse = [
      `data: ${JSON.stringify({
        choices: [{ delta: { content: answer }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      })}`,
      "data: [DONE]",
      "",
    ].join("\n")
    return new Response(sse, { status: 200 })
  }

  const drain = async (stream: ReadableStream<unknown>) => {
    const reader = stream.getReader()
    while (!(await reader.read()).done) {
      // consume the stream so the SSE parsing in `start` completes
    }
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("passes an https image URL through as an OpenAI-style image_url part", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())
    const imageUrl =
      "https://storage.googleapis.com/bucket/org/project/derived/doc/page-1.png?X-Goog-Signature=abc"

    await buildModel().doGenerate({
      prompt: [
        {
          role: "user",
          content: [{ type: "file", mediaType: "image/png", data: new URL(imageUrl) }],
        },
      ],
      providerOptions: { custom: { callOrigin: CallOrigin.generateStructuredOutput } },
      responseFormat: { type: "json", schema: { type: "object", properties: {} } },
    })

    const [, calledInit] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(String(calledInit?.body))
    expect(body.messages[0].content).toEqual([{ type: "image_url", image_url: { url: imageUrl } }])
  })

  it("still base64-inlines byte image parts", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())

    await buildModel().doGenerate({
      prompt: [
        {
          role: "user",
          content: [{ type: "file", mediaType: "image/png", data: new Uint8Array([1, 2, 3]) }],
        },
      ],
      providerOptions: { custom: { callOrigin: CallOrigin.generateStructuredOutput } },
      responseFormat: { type: "json", schema: { type: "object", properties: {} } },
    })

    const [, calledInit] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(String(calledInit?.body))
    const base64 = Buffer.from([1, 2, 3]).toString("base64")
    expect(body.messages[0].content).toEqual([
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
    ])
  })

  it("preserves image parts in the streaming chat path (doStreamWithTools)", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamingChatCompletionsResponse())
    const imageUrl =
      "https://storage.googleapis.com/bucket/org/project/derived/doc/page-1.png?X-Goog-Signature=abc"

    const { stream } = await buildModel().doStream({
      prompt: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this document" },
            { type: "file", mediaType: "image/png", data: new URL(imageUrl) },
          ],
        },
      ],
      providerOptions: { custom: { callOrigin: CallOrigin.streamChatResponse_withTools } },
    })
    await drain(stream)

    const [, calledInit] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(String(calledInit?.body))
    expect(body.messages[0].content).toEqual([
      { type: "text", text: "Describe this document" },
      { type: "image_url", image_url: { url: imageUrl } },
    ])
  })

  describe("supportedUrls", () => {
    it("only allows GCS signed urls", () => {
      const allowedPatterns = buildModel().supportedUrls["image/*"]

      const matchesAny = (candidateUrl: string) =>
        allowedPatterns.some((pattern) => pattern.test(candidateUrl))

      expect(matchesAny("https://storage.googleapis.com/bucket/x.png")).toBe(true)
      expect(matchesAny("https://evil.example.com/x.png")).toBe(false)
      expect(matchesAny("http://169.254.169.254/latest")).toBe(false)
    })
  })
})
